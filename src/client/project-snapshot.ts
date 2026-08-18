import { ARTICLE_FILE_ROUTE, PRODUCT_CATEGORY_ROUTE, PRODUCT_DOCUMENT_ROUTE, PRODUCT_IMAGE_INGEST_ROUTE, PRODUCT_IMAGE_ROUTE, PROJECT_EVENTS_ROUTE, PROJECT_SNAPSHOT_ROUTE, type ProjectSnapshot } from '../project-contract.ts'

function isSnapshot(value: unknown): value is ProjectSnapshot {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<ProjectSnapshot>
  return Array.isArray(candidate.articles) && Array.isArray(candidate.products)
    && Array.isArray(candidate.documents) && Array.isArray(candidate.images)
}

export async function fetchProjectSnapshot(sessionId: string, signal?: AbortSignal): Promise<ProjectSnapshot> {
  const query = new URLSearchParams({ sessionId })
  const response = await fetch(`${PROJECT_SNAPSHOT_ROUTE}?${query.toString()}`, {
    method: 'GET', cache: 'no-store', credentials: 'same-origin', ...(signal === undefined ? {} : { signal }),
  })
  if (!response.ok) throw new Error(`项目数据请求失败（${response.status}）`)
  const value: unknown = await response.json()
  if (!isSnapshot(value)) throw new Error('项目数据响应格式无效')
  return value
}

export async function fetchArticleFile(sessionId: string, path: string, signal?: AbortSignal): Promise<string> {
  const query = new URLSearchParams({ sessionId, path })
  const response = await fetch(`${ARTICLE_FILE_ROUTE}?${query.toString()}`, {
    method: 'GET', cache: 'no-store', credentials: 'same-origin', ...(signal === undefined ? {} : { signal }),
  })
  if (!response.ok) throw new Error(`文章文件读取失败（${response.status}）`)
  const value: unknown = await response.json()
  if (typeof value !== 'object' || value === null || typeof (value as { content?: unknown }).content !== 'string') throw new Error('文章文件响应格式无效')
  return (value as { content: string }).content
}

export async function fetchProductDocument(sessionId: string, path: string, signal?: AbortSignal): Promise<string> {
  const query = new URLSearchParams({ sessionId, path })
  const response = await fetch(`${PRODUCT_DOCUMENT_ROUTE}?${query.toString()}`, {
    method: 'GET', cache: 'no-store', credentials: 'same-origin', ...(signal === undefined ? {} : { signal }),
  })
  if (!response.ok) throw new Error(`素材文档读取失败（${response.status}）`)
  const value: unknown = await response.json()
  if (typeof value !== 'object' || value === null || typeof (value as { content?: unknown }).content !== 'string') throw new Error('素材文档响应格式无效')
  return (value as { content: string }).content
}

export function watchProjectSnapshot(sessionId: string, onChange: () => void): () => void {
  const events = new EventSource(`${PROJECT_EVENTS_ROUTE}?${new URLSearchParams({ sessionId }).toString()}`)
  events.addEventListener('change', onChange)
  return () => { events.close() }
}

export function articleFileUrl(sessionId: string, path: string): string {
  return `${ARTICLE_FILE_ROUTE}?${new URLSearchParams({ sessionId, path }).toString()}`
}

export function productImageUrl(sessionId: string, path: string): string {
  return `${PRODUCT_IMAGE_ROUTE}?${new URLSearchParams({ sessionId, path }).toString()}`
}

async function writeProjectData(route: string, sessionId: string, body: Record<string, string>): Promise<void> {
  const response = await fetch(`${route}?${new URLSearchParams({ sessionId }).toString()}`, {
    method: 'POST',
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (response.ok) return
  const value: unknown = await response.json().catch(() => undefined)
  const message = typeof value === 'object' && value !== null && typeof (value as { message?: unknown }).message === 'string'
    ? (value as { message: string }).message
    : `写入失败（${response.status}）`
  throw new Error(message)
}

export function createProductDocument(sessionId: string, product: string, filename: string, content: string): Promise<void> {
  return writeProjectData(PRODUCT_DOCUMENT_ROUTE, sessionId, { product, filename, content })
}

export function createProductCategory(sessionId: string, product: string): Promise<void> {
  return writeProjectData(PRODUCT_CATEGORY_ROUTE, sessionId, { product })
}

async function renameProjectData(route: string, sessionId: string, body: Record<string, string>): Promise<void> {
  const response = await fetch(`${route}?${new URLSearchParams({ sessionId }).toString()}`, {
    method: 'PATCH', cache: 'no-store', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (response.ok) return
  const value: unknown = await response.json().catch(() => undefined)
  const message = typeof value === 'object' && value !== null && typeof (value as { message?: unknown }).message === 'string' ? (value as { message: string }).message : `重命名失败（${response.status}）`
  throw new Error(message)
}

export function renameProductCategory(sessionId: string, product: string, nextProduct: string): Promise<void> {
  return renameProjectData(PRODUCT_CATEGORY_ROUTE, sessionId, { product, nextProduct })
}

export function renameProductDocument(sessionId: string, product: string, filename: string, nextFilename: string): Promise<void> {
  return renameProjectData(PRODUCT_DOCUMENT_ROUTE, sessionId, { product, filename, nextFilename })
}

export function renameProductImage(sessionId: string, product: string, filename: string, nextFilename: string): Promise<void> {
  return renameProjectData(PRODUCT_IMAGE_ROUTE, sessionId, { product, filename, nextFilename })
}

async function deleteProjectData(route: string, sessionId: string, body: Record<string, string>): Promise<void> {
  const response = await fetch(`${route}?${new URLSearchParams({ sessionId }).toString()}`, {
    method: 'DELETE', cache: 'no-store', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (response.ok) return
  const value: unknown = await response.json().catch(() => undefined)
  const message = typeof value === 'object' && value !== null && typeof (value as { message?: unknown }).message === 'string' ? (value as { message: string }).message : `删除失败（${response.status}）`
  throw new Error(message)
}

export function deleteProductDocument(sessionId: string, product: string, filename: string): Promise<void> {
  return deleteProjectData(PRODUCT_DOCUMENT_ROUTE, sessionId, { product, filename })
}

export function deleteProductImage(sessionId: string, product: string, filename: string): Promise<void> {
  return deleteProjectData(PRODUCT_IMAGE_ROUTE, sessionId, { product, filename })
}

export function ingestProductImage(sessionId: string, product: string, stem: string, description: string, dataUrl: string): Promise<void> {
  return writeProjectData(PRODUCT_IMAGE_INGEST_ROUTE, sessionId, { product, stem, description, dataUrl })
}
