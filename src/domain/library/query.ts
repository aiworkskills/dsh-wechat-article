import { readFile, stat } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { PRODUCTS_RELATIVE, resolveWorkspace, toRelativePath } from '../paths/workspace-paths.ts'
import { directDirectories, directFiles, IMAGE_EXTENSIONS } from './fs.ts'
import { imageDescription, markdownTitle, matches } from './text.ts'

export interface ProductSummary {
  readonly name: string
  readonly documentCount: number
  readonly imageCount: number
}

export interface ProductDocument {
  readonly product: string
  readonly path: string
  readonly title: string
  readonly content: string
}

export interface ProductImage {
  readonly product: string
  readonly imagePath: string
  readonly descriptionPath: string | null
  readonly description: string
}

export interface LibraryLimits {
  readonly maxDocumentBytes: number
  readonly maxResults: number
}

const PRODUCTS_PATH = PRODUCTS_RELATIVE

export async function listProducts(workspace: string, limits: LibraryLimits): Promise<ProductSummary[]> {
  const root = resolveWorkspace(workspace)
  const productsRoot = join(root, PRODUCTS_PATH)
  const products = await directDirectories(productsRoot)
  return Promise.all(products.slice(0, limits.maxResults).map(async (product) => {
    const productRoot = join(productsRoot, product)
    const documents = (await directFiles(productRoot)).filter(file => extname(file).toLowerCase() === '.md')
    const images = (await directFiles(join(productRoot, 'images')))
      .filter(file => IMAGE_EXTENSIONS.has(extname(file).toLowerCase()))
    return { name: product, documentCount: documents.length, imageCount: images.length }
  }))
}

export async function findDocuments(workspace: string, limits: LibraryLimits, options: {
  readonly product?: string
  readonly query?: string
} = {}): Promise<ProductDocument[]> {
  const root = resolveWorkspace(workspace)
  const productsRoot = join(root, PRODUCTS_PATH)
  const productNames = options.product === undefined
    ? await directDirectories(productsRoot)
    : (await directDirectories(productsRoot)).filter(name => name === options.product)
  const results: ProductDocument[] = []
  for (const product of productNames) {
    for (const filename of await directFiles(join(productsRoot, product))) {
      if (extname(filename).toLowerCase() !== '.md') continue
      const path = join(productsRoot, product, filename)
      const info = await stat(path)
      if (info.size > limits.maxDocumentBytes) continue
      const content = await readFile(path, 'utf8')
      const title = markdownTitle(filename, content)
      if (!matches(options.query, product, title, filename, content)) continue
      results.push({ product, path: toRelativePath(root, path), title, content })
      if (results.length >= limits.maxResults) return results
    }
  }
  return results
}

export async function findImages(workspace: string, limits: LibraryLimits, options: {
  readonly product?: string
  readonly query?: string
} = {}): Promise<ProductImage[]> {
  const root = resolveWorkspace(workspace)
  const productsRoot = join(root, PRODUCTS_PATH)
  const productNames = options.product === undefined
    ? await directDirectories(productsRoot)
    : (await directDirectories(productsRoot)).filter(name => name === options.product)
  const results: ProductImage[] = []
  for (const product of productNames) {
    const imagesRoot = join(productsRoot, product, 'images')
    const files = await directFiles(imagesRoot)
    const fileSet = new Set(files)
    for (const filename of files) {
      if (!IMAGE_EXTENSIONS.has(extname(filename).toLowerCase())) continue
      const imagePath = join(imagesRoot, filename)
      const sidecarName = `${basename(filename, extname(filename))}.md`
      const sidecarPath = join(imagesRoot, sidecarName)
      let description = ''
      let descriptionPath: string | null = null
      if (fileSet.has(sidecarName)) {
        const info = await stat(sidecarPath)
        if (info.size <= limits.maxDocumentBytes) {
          description = imageDescription(await readFile(sidecarPath, 'utf8'))
          descriptionPath = toRelativePath(root, sidecarPath)
        }
      }
      if (!matches(options.query, product, filename, description)) continue
      results.push({
        product,
        imagePath: toRelativePath(root, imagePath),
        descriptionPath,
        description,
      })
      if (results.length >= limits.maxResults) return results
    }
  }
  return results
}
