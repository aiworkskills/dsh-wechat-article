import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { WechatProductLibrary } from '../src/library.js'
import { projectSnapshot } from '../src/project-snapshot.js'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function article(root: string, name: string, files: Record<string, string>): Promise<void> {
  const directory = join(root, 'drafts', name)
  await mkdir(directory, { recursive: true })
  await Promise.all(Object.entries(files).map(async ([path, content]) => {
    const target = join(directory, path)
    await mkdir(join(target, '..'), { recursive: true })
    await writeFile(target, content)
  }))
}

function library(): WechatProductLibrary {
  return {
    listProducts: async () => [{ name: 'DSH', documentCount: 1, imageCount: 1 }],
    findDocuments: async () => [{ product: 'DSH', path: '.aws-article/products/DSH/介绍.md', title: 'DSH', content: '用于开发 AI Agent 的开源 Harness。' }],
    findImages: async () => [{ product: 'DSH', imagePath: '.aws-article/products/DSH/images/界面.png', descriptionPath: null, description: '' }],
  } as unknown as WechatProductLibrary
}

describe('project workspace snapshot', () => {
  it('derives article progress from real upstream Skill artifacts', async () => {
    const root = await mkdtemp(join(tmpdir(), 'wechat-project-'))
    roots.push(root)
    await mkdir(join(root, '.aws-article', 'products', 'DSH', 'images'), { recursive: true })
    await writeFile(join(root, '.aws-article', 'config.yaml'), 'drafts_root: drafts\n')
    await writeFile(join(root, '.aws-article', 'products', 'DSH', 'images', '界面.png'), 'image')
    await article(root, '20260818-topic', { 'article.yaml': 'title: 选题中\npublish_completed: false\n' })
    await article(root, '20260818-review', {
      'article.yaml': 'title: 待审稿\npublish_completed: false\n',
      'topic-card.md': 'topic',
      'draft.md': 'draft',
    })
    await article(root, '20260818-images', {
      'article.yaml': 'title: 待配图\npublish_completed: false\n',
      'topic-card.md': 'topic',
      'draft.md': 'draft',
      'article.md': '![正文：示意](placeholder)',
      'article.html': '<img href="placeholder">',
      'cover.png': 'cover image',
      'draft-stripped.md': 'temporary',
      'debug.log': 'ignore',
      'imgs/01-body.png': 'image',
      'imgs/README.md': 'ignore',
      'imgs/prompts/01-body.md': 'prompt',
      'imgs/prompts/not-an-output.png': 'ignore nested image',
    })
    await article(root, '20260818-published', {
      'article.yaml': 'title: 已发布\npublish_completed: true\n',
    })
    await utimes(join(root, 'drafts', '20260818-review', 'draft.md'), new Date('2026-08-18T08:00:00Z'), new Date('2026-08-18T08:00:00Z'))
    await utimes(join(root, 'drafts', '20260818-images', 'article.md'), new Date('2026-08-18T09:00:00Z'), new Date('2026-08-18T09:00:00Z'))
    await utimes(join(root, 'drafts', '20260818-images', 'article.html'), new Date('2026-08-18T10:00:00Z'), new Date('2026-08-18T10:00:00Z'))
    await utimes(join(root, 'drafts', '20260818-images', 'cover.png'), new Date('2026-08-18T10:30:00Z'), new Date('2026-08-18T10:30:00Z'))
    await utimes(join(root, 'drafts', '20260818-images', 'imgs', '01-body.png'), new Date('2026-08-18T11:00:00Z'), new Date('2026-08-18T11:00:00Z'))

    const snapshot = await projectSnapshot(root, library())
    const byTitle = new Map(snapshot.articles.map(item => [item.title, item]))
    expect(snapshot.articles.map(item => item.title)).toEqual(['待配图', '待审稿'])
    expect(byTitle.has('选题中')).toBe(false)
    expect(byTitle.has('已发布')).toBe(false)
    expect(byTitle.get('待审稿')).toMatchObject({ stage: 'review', issues: ['尚未生成定稿'] })
    expect(byTitle.get('待配图')).toMatchObject({ stage: 'images', issues: ['正文配图未完成'] })
    expect(byTitle.get('待配图')?.files.map(file => file.label)).toEqual([
      '定稿', '排版', '封面', '正文配图',
    ])
    expect(byTitle.get('待配图')?.files[0]?.path).toBe('drafts/20260818-images/article.md')
    expect(byTitle.get('待配图')?.updatedAt).toBe('2026-08-18T11:00:00.000Z')
    expect(snapshot.documents).toEqual([expect.objectContaining({ title: 'DSH', excerpt: '用于开发 AI Agent 的开源 Harness。' })])
  })
})
