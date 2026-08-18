import { readdir, readFile, stat } from 'node:fs/promises'
import { extname, isAbsolute, join, resolve, sep } from 'node:path'
import { parse } from 'yaml'
import { deriveArticleStage, stageLabels } from './domain/project/article-stage.ts'
import { resolveWorkspace, toRelativePath } from './domain/paths/workspace-paths.ts'
import type { ArticleFileKind, ArticleFileSummary, ArticleSummary, ProjectSnapshot } from './project-contract.ts'
import type { WechatProductLibrary } from './library.ts'

const ARTICLE_LIMIT_BYTES = 2 * 1024 * 1024
const COVER_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp']
const ARTICLE_IMAGE_EXTENSIONS = new Set([...COVER_EXTENSIONS, '.gif'])
const ARTICLE_ARTIFACTS: ReadonlyArray<{ readonly filename: string; readonly label: string; readonly kind: ArticleFileKind }> = [
  { filename: 'article.html', label: '排版', kind: 'html' },
]

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

async function directories(path: string): Promise<string[]> {
  try {
    return (await readdir(path, { withFileTypes: true }))
      .filter(entry => entry.isDirectory() && !entry.isSymbolicLink())
      .map(entry => entry.name)
      .sort((left, right) => right.localeCompare(left, 'zh-CN'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

async function imageFiles(path: string): Promise<string[]> {
  try {
    return (await readdir(path, { withFileTypes: true }))
      .filter(entry => entry.isFile() && !entry.isSymbolicLink() && ARTICLE_IMAGE_EXTENSIONS.has(extname(entry.name).toLowerCase()))
      .map(entry => entry.name)
      .sort((left, right) => left.localeCompare(right, 'zh-CN'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

async function articleFiles(workspace: string, articleDir: string): Promise<ArticleFileSummary[]> {
  const files: ArticleFileSummary[] = []
  const reviewed = join(articleDir, 'article.md')
  const draft = join(articleDir, 'draft.md')
  const hasReviewed = await isFile(reviewed)
  const markdown = hasReviewed ? reviewed : await isFile(draft) ? draft : null
  if (markdown !== null) files.push({ path: toRelativePath(workspace, markdown), label: hasReviewed ? '定稿' : '草稿', kind: 'markdown' })
  for (const artifact of ARTICLE_ARTIFACTS) {
    const path = join(articleDir, artifact.filename)
    if (!await isFile(path)) continue
    files.push({ path: toRelativePath(workspace, path), label: artifact.label, kind: artifact.kind })
  }
  for (const cover of await imageFiles(articleDir)) {
    if (!cover.toLocaleLowerCase().startsWith('cover.')) continue
    files.push({ path: toRelativePath(workspace, join(articleDir, cover)), label: '封面', kind: 'image' })
  }
  for (const image of await imageFiles(join(articleDir, 'imgs'))) {
    files.push({ path: toRelativePath(workspace, join(articleDir, 'imgs', image)), label: '正文配图', kind: 'image' })
  }
  return files
}

async function contentHasPlaceholder(path: string): Promise<boolean> {
  try {
    if ((await stat(path)).size > ARTICLE_LIMIT_BYTES) return true
    return (await readFile(path, 'utf8')).includes('placeholder')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

export async function resolveDraftRoot(workspaceInput: string): Promise<string> {
  const workspace = resolveWorkspace(workspaceInput)
  const configPath = join(workspace, '.aws-article', 'config.yaml')
  let configuredRoot: unknown
  try {
    configuredRoot = (parse(await readFile(configPath, 'utf8')) as Record<string, unknown>)?.drafts_root
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  const candidate = typeof configuredRoot === 'string' && configuredRoot.trim() !== ''
    ? configuredRoot.trim()
    : 'drafts'
  if (isAbsolute(candidate)) return join(workspace, 'drafts')
  const resolved = resolve(workspace, candidate)
  return resolved === workspace || resolved.startsWith(`${workspace}${sep}`) ? resolved : join(workspace, 'drafts')
}

function articleMetadata(path: string): { title: string; published: boolean } {
  try {
    const record = parse(path) as Record<string, unknown> | null
    return {
      title: typeof record?.title === 'string' && record.title.trim() !== '' ? record.title.trim() : '',
      published: record?.publish_completed === true,
    }
  } catch {
    return { title: '', published: false }
  }
}

async function inspectArticle(workspace: string, root: string, directory: string): Promise<ArticleSummary> {
  const articleDir = join(root, directory)
  const metadataPath = join(articleDir, 'article.yaml')
  const metadata = await isFile(metadataPath) ? articleMetadata(await readFile(metadataPath, 'utf8')) : { title: '', published: false }
  const topic = await isFile(join(articleDir, 'topic-card.md'))
  const draft = await isFile(join(articleDir, 'draft.md'))
  const article = await isFile(join(articleDir, 'article.md'))
  const html = await isFile(join(articleDir, 'article.html'))
  const cover = (await Promise.all(COVER_EXTENSIONS.map(extension => isFile(join(articleDir, `cover${extension}`)))))
    .some(Boolean)
  const placeholders = await contentHasPlaceholder(join(articleDir, 'article.md'))
    || await contentHasPlaceholder(join(articleDir, 'article.html'))
  const { stage, issues } = deriveArticleStage({
    published: metadata.published,
    topic,
    draft,
    article,
    html,
    cover,
    placeholders,
  })
  const files = await articleFiles(workspace, articleDir)
  const updatedAtMs = Math.max(0, ...await Promise.all(files.map(async file => (await stat(join(workspace, file.path))).mtimeMs)))
  return {
    path: toRelativePath(workspace, articleDir),
    title: metadata.title || directory.replace(/^\d{8}-/u, ''),
    updatedAt: new Date(updatedAtMs).toISOString(),
    stage,
    ...stageLabels(stage),
    issues,
    files,
  }
}

export async function projectSnapshot(workspaceInput: string, library: WechatProductLibrary): Promise<ProjectSnapshot> {
  const workspace = resolveWorkspace(workspaceInput)
  const root = await resolveDraftRoot(workspace)
  const articles = (await Promise.all((await directories(root)).map(directory => inspectArticle(workspace, root, directory))))
    .filter(article => article.files.length > 0)
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
  const [products, documents, images] = await Promise.all([
    library.listProducts(workspace),
    library.findDocuments(workspace),
    library.findImages(workspace),
  ])
  return {
    articles,
    products,
    documents: documents.map(document => ({
      product: document.product,
      path: document.path,
      title: document.title,
      excerpt: document.content.replace(/\s+/gu, ' ').trim().slice(0, 140),
    })),
    images: images.map(image => ({
      product: image.product,
      path: image.imagePath,
      description: image.description,
      hasDescription: image.description.trim() !== '' && !image.description.includes('请根据图片补全'),
    })),
  }
}

export async function resolveArticleFile(workspaceInput: string, path: string): Promise<string | null> {
  const workspace = resolveWorkspace(workspaceInput)
  const root = await resolveDraftRoot(workspace)
  const candidate = resolve(workspace, path)
  return candidate.startsWith(`${root}${sep}`) ? candidate : null
}
