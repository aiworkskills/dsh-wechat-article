import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { PRODUCTS_RELATIVE, resolveWorkspace, toRelativePath } from '../paths/workspace-paths.ts'
import { IMAGE_EXTENSIONS, pathExists } from './fs.ts'
import { libraryName } from './text.ts'
import type { LibraryLimits } from './query.ts'

const PRODUCTS_PATH = PRODUCTS_RELATIVE

export interface ProductDocumentWriteRequest {
  readonly workspace: string
  readonly product: string
  readonly filename: string
  readonly content: string
}

export interface ProductCategoryCreateRequest {
  readonly workspace: string
  readonly product: string
}

export interface ProductCategoryRenameRequest extends ProductCategoryCreateRequest {
  readonly nextProduct: string
}

export interface ProductDocumentRenameRequest extends ProductCategoryCreateRequest {
  readonly filename: string
  readonly nextFilename: string
}

export interface ProductImageRenameRequest extends ProductDocumentRenameRequest {}

export interface ProductFileDeleteRequest extends ProductCategoryCreateRequest {
  readonly filename: string
}

export async function createDocument(request: ProductDocumentWriteRequest, limits: LibraryLimits): Promise<{ readonly path: string }> {
  const workspace = resolveWorkspace(request.workspace)
  const product = libraryName(request.product, '产品名')
  const filename = libraryName(request.filename, '文件名', '.md')
  const content = request.content.trim()
  if (content === '') throw new Error('资料正文不能为空')
  if (Buffer.byteLength(content, 'utf8') > limits.maxDocumentBytes) throw new Error('资料正文过大')
  const productRoot = join(workspace, PRODUCTS_PATH, product)
  await mkdir(join(productRoot, 'images'), { recursive: true })
  const target = join(productRoot, filename)
  try {
    await stat(target)
    throw new Error('同名资料已存在，请更换文件名')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  await writeFile(target, `${content}\n`, 'utf8')
  return { path: toRelativePath(workspace, target) }
}

export async function createProduct(request: ProductCategoryCreateRequest): Promise<{ readonly path: string }> {
  const workspace = resolveWorkspace(request.workspace)
  const product = libraryName(request.product, '产品名')
  const productRoot = join(workspace, PRODUCTS_PATH, product)
  try {
    await stat(productRoot)
    throw new Error('同名素材文件夹已存在')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  await mkdir(join(productRoot, 'images'), { recursive: true })
  return { path: toRelativePath(workspace, productRoot) }
}

export async function renameProduct(request: ProductCategoryRenameRequest): Promise<{ readonly path: string }> {
  const workspace = resolveWorkspace(request.workspace)
  const product = libraryName(request.product, '产品名')
  const nextProduct = libraryName(request.nextProduct, '新产品名')
  if (product === nextProduct) return { path: toRelativePath(workspace, join(workspace, PRODUCTS_PATH, product)) }
  const source = join(workspace, PRODUCTS_PATH, product)
  const target = join(workspace, PRODUCTS_PATH, nextProduct)
  try {
    if (!(await stat(source)).isDirectory()) throw new Error('原素材文件夹不存在')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new Error('原素材文件夹不存在')
    throw error
  }
  try {
    await stat(target)
    throw new Error('同名素材文件夹已存在')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  await rename(source, target)
  return { path: toRelativePath(workspace, target) }
}

export async function renameDocument(request: ProductDocumentRenameRequest): Promise<{ readonly path: string }> {
  const workspace = resolveWorkspace(request.workspace)
  const product = libraryName(request.product, '产品名')
  const filename = libraryName(request.filename, '文件名', '.md')
  const nextFilename = libraryName(request.nextFilename, '新文件名', '.md')
  const productRoot = join(workspace, PRODUCTS_PATH, product)
  const source = join(productRoot, filename)
  const target = join(productRoot, nextFilename)
  if (source === target) return { path: toRelativePath(workspace, source) }
  if (!await pathExists(source)) throw new Error('原资料文件不存在')
  if (await pathExists(target)) throw new Error('同名资料已存在')
  await rename(source, target)
  return { path: toRelativePath(workspace, target) }
}

export async function renameImage(request: ProductImageRenameRequest): Promise<{ readonly path: string }> {
  const workspace = resolveWorkspace(request.workspace)
  const product = libraryName(request.product, '产品名')
  const filename = libraryName(request.filename, '图片名')
  const sourceExtension = extname(filename)
  if (!IMAGE_EXTENSIONS.has(sourceExtension.toLowerCase())) throw new Error('原图片格式不受支持')
  const requestedExtension = extname(request.nextFilename.trim())
  if (IMAGE_EXTENSIONS.has(requestedExtension.toLowerCase()) && requestedExtension.toLowerCase() !== sourceExtension.toLowerCase()) {
    throw new Error('重命名不能修改图片格式')
  }
  const requestedBase = IMAGE_EXTENSIONS.has(requestedExtension.toLowerCase())
    ? basename(request.nextFilename.trim(), requestedExtension)
    : request.nextFilename
  const nextFilename = `${libraryName(requestedBase, '新图片名')}${sourceExtension}`
  const imagesRoot = join(workspace, PRODUCTS_PATH, product, 'images')
  const source = join(imagesRoot, filename)
  const target = join(imagesRoot, nextFilename)
  if (source === target) return { path: toRelativePath(workspace, source) }
  if (!await pathExists(source)) throw new Error('原图片不存在')
  if (await pathExists(target)) throw new Error('同名图片已存在')

  const sourceSidecar = join(imagesRoot, `${basename(filename, sourceExtension)}.md`)
  const targetSidecar = join(imagesRoot, `${basename(nextFilename, sourceExtension)}.md`)
  const hasSidecar = await pathExists(sourceSidecar)
  if (hasSidecar && await pathExists(targetSidecar)) throw new Error('同名图片说明已存在')
  const sidecarContent = hasSidecar ? await readFile(sourceSidecar, 'utf8') : null
  await rename(source, target)
  if (hasSidecar) {
    try {
      await rename(sourceSidecar, targetSidecar)
      await writeFile(targetSidecar, sidecarContent!.replaceAll(toRelativePath(workspace, source), toRelativePath(workspace, target)), 'utf8')
    } catch (error) {
      if (await pathExists(targetSidecar)) await rename(targetSidecar, sourceSidecar).catch(() => undefined)
      await rename(target, source).catch(() => undefined)
      throw error
    }
  }
  return { path: toRelativePath(workspace, target) }
}

export async function deleteDocument(request: ProductFileDeleteRequest): Promise<void> {
  const workspace = resolveWorkspace(request.workspace)
  const product = libraryName(request.product, '产品名')
  const filename = libraryName(request.filename, '文件名', '.md')
  const target = join(workspace, PRODUCTS_PATH, product, filename)
  if (!await pathExists(target)) throw new Error('资料文件不存在')
  await rm(target)
}

export async function deleteImage(request: ProductFileDeleteRequest): Promise<void> {
  const workspace = resolveWorkspace(request.workspace)
  const product = libraryName(request.product, '产品名')
  const filename = libraryName(request.filename, '图片名')
  const extension = extname(filename)
  if (!IMAGE_EXTENSIONS.has(extension.toLowerCase())) throw new Error('图片格式不受支持')
  const imagesRoot = join(workspace, PRODUCTS_PATH, product, 'images')
  const image = join(imagesRoot, filename)
  if (!await pathExists(image)) throw new Error('图片不存在')
  await rm(image)
  await rm(join(imagesRoot, `${basename(filename, extension)}.md`), { force: true })
}
