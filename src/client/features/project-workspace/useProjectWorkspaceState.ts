import { useCallback, useEffect, useState } from 'react'
import type { ProductDocumentSummary, ProductImageSummary, ProjectSnapshot } from '../../../project-contract.ts'
import {
  createProductCategory,
  createProductDocument,
  deleteProductDocument,
  deleteProductImage,
  fetchProjectSnapshot,
  ingestProductImage,
  renameProductCategory,
  renameProductDocument,
  renameProductImage,
  watchProjectSnapshot,
} from '../../project-snapshot.ts'

type Load = { readonly phase: 'loading' } | { readonly phase: 'ready'; readonly data: ProjectSnapshot } | { readonly phase: 'error'; readonly message: string }

export interface MaterialUpload {
  readonly file: File
  readonly relativePath: string
}

function filename(path: string): string {
  return path.split('/').at(-1) ?? path
}

function isHiddenUpload(upload: MaterialUpload): boolean {
  return upload.relativePath.replaceAll('\\', '/').split('/').some(part => part.startsWith('.'))
}

function flattenedUploadName(upload: MaterialUpload): string {
  const parts = upload.relativePath.replaceAll('\\', '/').split('/').filter(Boolean)
  return parts.length === 0 ? upload.file.name : parts.join('-')
}

function fileDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => { reject(new Error('图片读取失败')) }
    reader.onload = () => { typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('图片读取失败')) }
    reader.readAsDataURL(file)
  })
}

export interface ProjectWorkspaceState {
  readonly load: Load
  readonly snapshot: ProjectSnapshot | undefined
  readonly mutationBusy: boolean
  readonly mutationError: string
  readonly refresh: () => Promise<void>
  readonly createCategory: (name: string) => void
  readonly renameCategory: (category: string, nextCategory: string) => void
  readonly renameDocument: (item: ProductDocumentSummary, nextFilename: string) => void
  readonly renameImage: (item: ProductImageSummary, nextFilename: string) => void
  readonly deleteDocument: (item: ProductDocumentSummary) => void
  readonly deleteImage: (item: ProductImageSummary) => void
  readonly uploadMaterialFiles: (category: string, uploads: readonly MaterialUpload[]) => void
}

export function useProjectWorkspaceState(sessionId: string, view: 'create' | 'materials'): ProjectWorkspaceState {
  const [load, setLoad] = useState<Load>({ phase: 'loading' })
  const [mutationBusy, setMutationBusy] = useState(false)
  const [mutationError, setMutationError] = useState('')

  useEffect(() => { setMutationError('') }, [view])

  const refresh = useCallback(async (): Promise<void> => {
    try {
      setLoad({ phase: 'ready', data: await fetchProjectSnapshot(sessionId) })
    } catch (error) {
      setLoad(previous => previous.phase === 'ready' ? previous : { phase: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }, [sessionId])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => watchProjectSnapshot(sessionId, () => { void refresh() }), [refresh, sessionId])

  const snapshot = load.phase === 'ready' ? load.data : undefined

  const runMutation = useCallback((action: () => Promise<void>): void => {
    if (mutationBusy) return
    setMutationBusy(true)
    setMutationError('')
    void action()
      .then(() => { void refresh() })
      .catch(error => { setMutationError(error instanceof Error ? error.message : String(error)) })
      .finally(() => { setMutationBusy(false) })
  }, [mutationBusy, refresh])

  const createCategory = useCallback((name: string): void => {
    runMutation(() => createProductCategory(sessionId, name))
  }, [runMutation, sessionId])

  const renameCategory = useCallback((category: string, nextCategory: string): void => {
    if (category === nextCategory) return
    runMutation(() => renameProductCategory(sessionId, category, nextCategory))
  }, [runMutation, sessionId])

  const renameDocument = useCallback((item: ProductDocumentSummary, nextFilename: string): void => {
    if (filename(item.path) === nextFilename) return
    runMutation(() => renameProductDocument(sessionId, item.product, filename(item.path), nextFilename))
  }, [runMutation, sessionId])

  const renameImage = useCallback((item: ProductImageSummary, nextFilename: string): void => {
    if (filename(item.path) === nextFilename) return
    runMutation(() => renameProductImage(sessionId, item.product, filename(item.path), nextFilename))
  }, [runMutation, sessionId])

  const deleteDocument = useCallback((item: ProductDocumentSummary): void => {
    runMutation(() => deleteProductDocument(sessionId, item.product, filename(item.path)))
  }, [runMutation, sessionId])

  const deleteImage = useCallback((item: ProductImageSummary): void => {
    runMutation(() => deleteProductImage(sessionId, item.product, filename(item.path)))
  }, [runMutation, sessionId])

  const uploadMaterialFiles = useCallback((category: string, uploads: readonly MaterialUpload[]): void => {
    if (mutationBusy || uploads.length === 0) return
    const visibleUploads = uploads.filter(upload => !isHiddenUpload(upload))
    const documents = visibleUploads.filter(upload => /\.(md|txt)$/iu.test(upload.file.name))
    const images = visibleUploads.filter(upload => /\.(png|jpe?g|webp|gif)$/iu.test(upload.file.name) || /^image\/(?:png|jpeg|webp|gif)$/u.test(upload.file.type))
    const unsupported = visibleUploads.filter(upload => !documents.includes(upload) && !images.includes(upload))
    if (unsupported.length > 0) { setMutationError(`不支持这些文件：${unsupported.slice(0, 3).map(upload => upload.file.name).join('、')}`); return }
    if (documents.length === 0 && images.length === 0) { setMutationError('文件夹中没有可导入的文档或图片'); return }
    if (documents.length > 200 || images.length > 200) { setMutationError('单次目录导入的文档和图片不能分别超过 200 个'); return }
    if (documents.some(upload => upload.file.size > 1024 * 1024)) { setMutationError('单个文档不能超过 1 MB'); return }
    if (images.some(upload => upload.file.size > 10 * 1024 * 1024)) { setMutationError('单张图片不能超过 10 MB'); return }
    setMutationBusy(true)
    setMutationError('')
    const documentWrites = documents.map(async upload => {
      const content = await upload.file.text()
      if (content.trim() === '') throw new Error(`${upload.file.name} 内容为空`)
      await createProductDocument(sessionId, category, flattenedUploadName(upload).replace(/\.(md|txt)$/iu, '.md'), content)
    })
    const imageWrites = images.map(async upload => {
      const stem = flattenedUploadName(upload).replace(/\.[^.]+$/u, '').trim() || '图片'
      await ingestProductImage(sessionId, category, stem, '', await fileDataUrl(upload.file))
    })
    void Promise.all([...documentWrites, ...imageWrites])
      .then(() => { void refresh() })
      .catch(error => { setMutationError(error instanceof Error ? error.message : String(error)) })
      .finally(() => { setMutationBusy(false) })
  }, [mutationBusy, refresh, sessionId])

  return {
    load,
    snapshot,
    mutationBusy,
    mutationError,
    refresh,
    createCategory,
    renameCategory,
    renameDocument,
    renameImage,
    deleteDocument,
    deleteImage,
    uploadMaterialFiles,
  }
}
