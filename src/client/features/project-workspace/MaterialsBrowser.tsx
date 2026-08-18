import { useEffect, useRef, useState } from 'react'
import type { InputHTMLAttributes } from 'react'
import { Button, IconBrowseOutline16, IconCheckOutline16, IconCloseOutline16, IconFolderClose16, IconFolderOpenOutline16, IconPaperclipOutline16, IconPlusOutline16, IconTrashOutline16, MarkdownText, Modal, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ProductDocumentSummary, ProductImageSummary, ProjectSnapshot } from '../../../project-contract.ts'
import { fetchProductDocument, productImageUrl } from '../../project-snapshot.ts'
import type { Preview } from './ArticlePreview.tsx'
import { filename } from './format.ts'
import { uploadsFromDrop, uploadsFromFiles } from './material-upload.ts'
import type { MaterialUpload } from './useProjectWorkspaceState.ts'
import css from '../../workbench.module.css'

const DIRECTORY_INPUT_PROPS: InputHTMLAttributes<HTMLInputElement> & { readonly webkitdirectory: string; readonly directory: string } = { webkitdirectory: '', directory: '' }

type MaterialPreview = { readonly kind: 'document'; readonly item: ProductDocumentSummary } | { readonly kind: 'image'; readonly item: ProductImageSummary }

function Empty({ children }: { readonly children: string }) {
  return <div className={css.emptyState}>{children}</div>
}

function MaterialFile({ kind, item, sessionId, busy, onPreview, onRename, onDelete }: {
  readonly kind: 'document' | 'image'
  readonly item: ProductDocumentSummary | ProductImageSummary
  readonly sessionId: string
  readonly busy: boolean
  readonly onPreview: () => void
  readonly onRename: (nextFilename: string) => void
  readonly onDelete: () => void
}) {
  const currentName = filename(item.path)
  const [renaming, setRenaming] = useState(false)
  const [nextName, setNextName] = useState(currentName)
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (previewTimer.current !== null) clearTimeout(previewTimer.current)
  }, [])
  const schedulePreview = (): void => {
    if (previewTimer.current !== null) clearTimeout(previewTimer.current)
    previewTimer.current = setTimeout(() => { previewTimer.current = null; onPreview() }, 220)
  }
  const beginRename = (event: { preventDefault: () => void; stopPropagation: () => void }): void => {
    event.preventDefault()
    event.stopPropagation()
    if (previewTimer.current !== null) clearTimeout(previewTimer.current)
    previewTimer.current = null
    setNextName(currentName)
    setRenaming(true)
  }
  const submitRename = (): void => {
    const value = nextName.trim()
    if (value === '') return
    setRenaming(false)
    onRename(value)
  }
  const icon = kind === 'document'
    ? <span className={css.documentIcon}>#</span>
    : <img className={css.materialImageThumb} src={productImageUrl(sessionId, item.path)} alt="" />
  const detail = kind === 'document'
    ? 'Markdown 文档'
    : `图片 · ${(item as ProductImageSummary).hasDescription ? '已描述' : '待补描述'}`

  if (renaming) return <form className={`${css.materialFileRow} ${css.materialFileRenameRow}`} onSubmit={event => { event.preventDefault(); event.stopPropagation(); submitRename() }}>
    {icon}
    <span className={css.materialFileRenameControls}>
      <input value={nextName} aria-label={`重命名 ${currentName}`} autoFocus onFocus={event => { event.currentTarget.select() }} onChange={event => { setNextName(event.target.value) }} />
      <Tooltip label="确认重命名" side="top"><button className={css.compactIconButton} type="submit" aria-label={`确认重命名 ${currentName}`} disabled={busy || nextName.trim() === ''}><IconCheckOutline16 /></button></Tooltip>
      <Tooltip label="取消" side="top"><button className={css.compactIconButton} type="button" aria-label={`取消重命名 ${currentName}`} onClick={() => { setRenaming(false); setNextName(currentName) }}><IconCloseOutline16 /></button></Tooltip>
    </span>
  </form>

  return <div className={css.materialFileRowShell}>
    <button className={css.materialFileRow} type="button" onClick={schedulePreview}>
      {icon}
      <span onDoubleClick={beginRename} title="双击重命名"><strong>{currentName}</strong><small>{detail}</small></span>
    </button>
    <Tooltip label={`删除 ${currentName}`} side="top"><button className={css.materialFileDelete} type="button" aria-label={`删除 ${currentName}`} disabled={busy} onClick={() => {
      const detail = kind === 'image' ? '，对应的图片说明也会删除' : ''
      if (window.confirm(`确定删除“${currentName}”${detail}？`)) onDelete()
    }}><IconTrashOutline16 /></button></Tooltip>
  </div>
}

function MaterialFolder({ category, documents, images, sessionId, busy, onUpload, onRename, onRenameDocument, onRenameImage, onDeleteDocument, onDeleteImage, onPreview }: {
  readonly category: string
  readonly documents: readonly ProductDocumentSummary[]
  readonly images: readonly ProductImageSummary[]
  readonly sessionId: string
  readonly busy: boolean
  readonly onUpload: (category: string, files: readonly MaterialUpload[]) => void
  readonly onRename: (category: string, nextCategory: string) => void
  readonly onRenameDocument: (item: ProductDocumentSummary, nextFilename: string) => void
  readonly onRenameImage: (item: ProductImageSummary, nextFilename: string) => void
  readonly onDeleteDocument: (item: ProductDocumentSummary) => void
  readonly onDeleteImage: (item: ProductImageSummary) => void
  readonly onPreview: (preview: MaterialPreview) => void
}) {
  const documentInput = useRef<HTMLInputElement>(null)
  const imageInput = useRef<HTMLInputElement>(null)
  const folderInput = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [nextName, setNextName] = useState(category)
  const [folderError, setFolderError] = useState('')
  const stopSummary = (event: { preventDefault: () => void; stopPropagation: () => void }): void => { event.preventDefault(); event.stopPropagation() }
  const stopBubbling = (event: { stopPropagation: () => void }): void => { event.stopPropagation() }
  const beginRename = (event: { preventDefault: () => void; stopPropagation: () => void }): void => {
    stopSummary(event)
    setNextName(category)
    setRenaming(true)
  }
  const submitRename = (): void => {
    const value = nextName.trim()
    if (value === '') return
    setRenaming(false)
    onRename(category, value)
  }
  const readDrop = (transfer: DataTransfer): void => {
    setFolderError('')
    void uploadsFromDrop(transfer).then(files => { onUpload(category, files) }).catch(error => { setFolderError(error instanceof Error ? error.message : String(error)) })
  }
  return <details className={dragging ? css.materialGroupDropActive : css.materialGroup}
    onDragEnter={event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); setDragging(true) } }}
    onDragOver={event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' } }}
    onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false) }}
    onDrop={event => { event.preventDefault(); setDragging(false); readDrop(event.dataTransfer) }}>
    <summary className={css.materialGroupHeader}><span className={css.materialFolderIdentity}><span className={css.closedFolderIcon}><IconFolderClose16 /></span><span className={css.openFolderIcon}><IconFolderOpenOutline16 /></span>{renaming
      ? <form className={css.renameCategoryRow} onClick={stopBubbling} onSubmit={event => { event.preventDefault(); event.stopPropagation(); submitRename() }}><input value={nextName} aria-label={`重命名 ${category}`} autoFocus onFocus={event => { event.currentTarget.select() }} onChange={event => { setNextName(event.target.value) }} /><Tooltip label="确认重命名" side="top"><button className={css.compactIconButton} type="submit" aria-label="确认重命名" disabled={busy || nextName.trim() === ''}><IconCheckOutline16 /></button></Tooltip><Tooltip label="取消" side="top"><button className={css.compactIconButton} type="button" aria-label="取消重命名" onClick={() => { setRenaming(false); setNextName(category) }}><IconCloseOutline16 /></button></Tooltip></form>
      : <span className={css.materialFolderName} onClick={stopSummary} onDoubleClick={beginRename} title="双击重命名"><strong>{category}</strong><small>{documents.length} 文档 · {images.length} 图片</small></span>}</span>{!renaming && <span className={css.sectionActions} onClick={stopSummary}>
      <Tooltip label={`向 ${category} 添加文档`} side="top"><button className={css.compactIconButton} type="button" aria-label={`向 ${category} 添加文档`} disabled={busy} onClick={() => { documentInput.current?.click() }}><IconPaperclipOutline16 /></button></Tooltip>
      <Tooltip label={`向 ${category} 添加图片`} side="top"><button className={css.compactIconButton} type="button" aria-label={`向 ${category} 添加图片`} disabled={busy} onClick={() => { imageInput.current?.click() }}><IconBrowseOutline16 /></button></Tooltip>
      <Tooltip label={`向 ${category} 导入文件夹`} side="top"><button className={css.compactIconButton} type="button" aria-label={`向 ${category} 导入文件夹`} disabled={busy} onClick={() => { folderInput.current?.click() }}><IconFolderOpenOutline16 /></button></Tooltip>
    </span>}</summary>
    <input ref={documentInput} className={css.hiddenFileInput} type="file" accept=".md,.txt,text/markdown,text/plain" multiple onChange={event => { onUpload(category, uploadsFromFiles(event.target.files ?? [])); event.target.value = '' }} />
    <input ref={imageInput} className={css.hiddenFileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple onChange={event => { onUpload(category, uploadsFromFiles(event.target.files ?? [])); event.target.value = '' }} />
    <input ref={folderInput} className={css.hiddenFileInput} type="file" multiple {...DIRECTORY_INPUT_PROPS} onChange={event => { onUpload(category, uploadsFromFiles(event.target.files ?? [])); event.target.value = '' }} />
    <div className={css.materialFolderBody}>
      <div className={css.materialFileList}>
        {documents.map(document => <MaterialFile kind="document" item={document} sessionId={sessionId} busy={busy} key={document.path} onPreview={() => { onPreview({ kind: 'document', item: document }) }} onRename={nextFilename => { onRenameDocument(document, nextFilename) }} onDelete={() => { onDeleteDocument(document) }} />)}
        {images.map(image => <MaterialFile kind="image" item={image} sessionId={sessionId} busy={busy} key={image.path} onPreview={() => { onPreview({ kind: 'image', item: image }) }} onRename={nextFilename => { onRenameImage(image, nextFilename) }} onDelete={() => { onDeleteImage(image) }} />)}
      </div>
      {documents.length === 0 && images.length === 0 && <span className={css.productGroupEmpty}>分类下暂无素材</span>}
      {folderError !== '' && <span className={css.folderError}>{folderError}</span>}
    </div>
    {dragging && <div className={css.materialDropOverlay}>添加到 {category}</div>}
  </details>
}

export function MaterialsBrowser({ snapshot, sessionId, busy, error, onCreateCategory, onRenameCategory, onRenameDocument, onRenameImage, onDeleteDocument, onDeleteImage, onUploadFiles }: {
  readonly snapshot: ProjectSnapshot
  readonly sessionId: string
  readonly busy: boolean
  readonly error: string
  readonly onCreateCategory: (name: string) => void
  readonly onRenameCategory: (category: string, nextCategory: string) => void
  readonly onRenameDocument: (item: ProductDocumentSummary, nextFilename: string) => void
  readonly onRenameImage: (item: ProductImageSummary, nextFilename: string) => void
  readonly onDeleteDocument: (item: ProductDocumentSummary) => void
  readonly onDeleteImage: (item: ProductImageSummary) => void
  readonly onUploadFiles: (category: string, files: readonly MaterialUpload[]) => void
}) {
  const [materialPreview, setMaterialPreview] = useState<MaterialPreview | null>(null)
  const [documentPreview, setDocumentPreview] = useState<Preview>({ phase: 'idle' })
  const [creating, setCreating] = useState(false)
  const [categoryName, setCategoryName] = useState('')

  useEffect(() => {
    if (materialPreview?.kind !== 'document') { setDocumentPreview({ phase: 'idle' }); return }
    const controller = new AbortController()
    setDocumentPreview({ phase: 'loading' })
    void fetchProductDocument(sessionId, materialPreview.item.path, controller.signal)
      .then(content => { if (!controller.signal.aborted) setDocumentPreview({ phase: 'ready', content }) })
      .catch(error => { if (!controller.signal.aborted) setDocumentPreview({ phase: 'error', message: error instanceof Error ? error.message : String(error) }) })
    return () => { controller.abort() }
  }, [materialPreview, sessionId])

  const submitCategory = (): void => {
    const name = categoryName.trim()
    if (name === '') return
    onCreateCategory(name)
    setCategoryName('')
    setCreating(false)
  }
  return <main className={css.content}>
    <section className={css.sectionHeading}><div><h2>写作素材</h2><p>按内容方向整理文档与图片</p></div><Tooltip label="添加内容方向" side="bottom"><button className={css.compactIconButton} type="button" aria-label="添加内容方向" disabled={busy} onClick={() => { setCreating(true) }}><IconPlusOutline16 /></button></Tooltip></section>
    {creating && <form className={css.newCategoryRow} onSubmit={event => { event.preventDefault(); submitCategory() }}><IconFolderClose16 /><input value={categoryName} placeholder="添加一个全新的内容方向" aria-label="添加一个全新的内容方向" autoFocus onChange={event => { setCategoryName(event.target.value) }} /><Tooltip label="创建文件夹" side="top"><button className={css.compactIconButton} type="submit" aria-label="创建文件夹" disabled={busy || categoryName.trim() === ''}><IconCheckOutline16 /></button></Tooltip><Tooltip label="取消" side="top"><button className={css.compactIconButton} type="button" aria-label="取消添加内容方向" onClick={() => { setCreating(false); setCategoryName('') }}><IconCloseOutline16 /></button></Tooltip></form>}
    {error !== '' && <div className={css.operationError} role="alert">{error}</div>}
    {busy && <div className={css.materialStatus}>正在处理素材</div>}
    {snapshot.products.length === 0 ? <Empty>还没有写作素材。请先添加一个内容方向。</Empty> : <div className={css.materialGroups}>{snapshot.products.map(category => {
      const documents = snapshot.documents.filter(item => item.product === category.name)
      const images = snapshot.images.filter(item => item.product === category.name)
      return <MaterialFolder category={category.name} documents={documents} images={images} sessionId={sessionId} busy={busy} onUpload={onUploadFiles} onRename={onRenameCategory} onRenameDocument={onRenameDocument} onRenameImage={onRenameImage} onDeleteDocument={onDeleteDocument} onDeleteImage={onDeleteImage} onPreview={setMaterialPreview} key={category.name} />
    })}</div>}
    {materialPreview?.kind === 'document' && <Modal open onClose={() => { setMaterialPreview(null) }} title={materialPreview.item.title} description={materialPreview.item.path} closeLabel="关闭预览" {...(css.previewModal === undefined ? {} : { className: css.previewModal })} {...(css.previewModalContent === undefined ? {} : { contentClassName: css.previewModalContent })} footer={<Button variant="toolbar" onClick={() => { setMaterialPreview(null) }}>关闭</Button>}>
      {documentPreview.phase === 'loading' ? <div className={css.previewState}>正在读取文档</div> : documentPreview.phase === 'error' ? <div className={css.operationError}>{documentPreview.message}</div> : documentPreview.phase === 'ready' ? <article className={css.markdownPreviewModal}><MarkdownText text={documentPreview.content} /></article> : null}
    </Modal>}
    {materialPreview?.kind === 'image' && <Modal open onClose={() => { setMaterialPreview(null) }} title={filename(materialPreview.item.path)} description={materialPreview.item.product} closeLabel="关闭预览" {...(css.previewModal === undefined ? {} : { className: css.previewModal })} {...(css.previewModalContent === undefined ? {} : { contentClassName: css.previewModalContent })} footer={<Button variant="toolbar" onClick={() => { setMaterialPreview(null) }}>关闭</Button>}><figure className={css.materialImagePreview}><img src={productImageUrl(sessionId, materialPreview.item.path)} alt={materialPreview.item.description || filename(materialPreview.item.path)} /><figcaption>{materialPreview.item.description || '缺少图片说明'}</figcaption></figure></Modal>}
  </main>
}
