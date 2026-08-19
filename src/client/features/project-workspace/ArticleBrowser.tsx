import { useEffect, useState } from 'react'
import { Button, IconFolderClose16, IconFolderOpenOutline16, IconLinkOutline16, Modal, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ArticleFileSummary, ProjectSnapshot } from '../../../project-contract.ts'
import { articleFileUrl, fetchArticleFile } from '../../project-snapshot.ts'
import { ArticlePreview, type Preview } from './ArticlePreview.tsx'
import { articleTime, filename } from './format.ts'
import css from '../../workbench.module.css'

function Empty({ children }: { readonly children: string }) {
  return <div className={css.emptyState}>{children}</div>
}

export function ArticleBrowser({
  snapshot,
  sessionId,
  onReferenceFile,
}: {
  readonly snapshot: ProjectSnapshot
  readonly sessionId: string
  readonly onReferenceFile: (path: string) => void
}) {
  const [selectedFile, setSelectedFile] = useState<ArticleFileSummary | null>(null)
  const [preview, setPreview] = useState<Preview>({ phase: 'idle' })

  useEffect(() => {
    if (selectedFile === null) { setPreview({ phase: 'idle' }); return }
    if (selectedFile.kind === 'image') { setPreview({ phase: 'idle' }); return }
    const controller = new AbortController()
    setPreview({ phase: 'loading' })
    void fetchArticleFile(sessionId, selectedFile.path, controller.signal)
      .then(content => { if (!controller.signal.aborted) setPreview({ phase: 'ready', content }) })
      .catch(error => { if (!controller.signal.aborted) setPreview({ phase: 'error', message: error instanceof Error ? error.message : String(error) }) })
    return () => { controller.abort() }
  }, [selectedFile, sessionId])

  return <main className={css.content}>
    <section className={css.sectionHeading}>
      <div><h2>文章文件</h2><p>最近更新</p></div>
    </section>
    {snapshot.articles.length === 0
      ? <Empty>生成草稿、定稿或排版后，文章会出现在这里。</Empty>
      : <div className={css.articleFolders}>{snapshot.articles.map((article, index) => <details className={css.articleFolder} open={index === 0} key={article.path}>
        <summary className={css.articleFolderHeader}>
          <span className={css.materialFolderIdentity}>
            <span className={css.closedFolderIcon}><IconFolderClose16 /></span>
            <span className={css.openFolderIcon}><IconFolderOpenOutline16 /></span>
            <span><strong>{article.title}</strong><small>{article.stageLabel} · {articleTime(article.updatedAt)}</small></span>
          </span>
        </summary>
        <div className={css.articleFileList}>{article.files.length === 0
          ? <span className={css.articleFolderEmpty}>暂无文件</span>
          : article.files.map(file => <div className={css.articleFileRow} key={file.path}>
          <button type="button" className={css.articleFileOpen} onClick={() => { setSelectedFile(file) }}>
            {file.kind === 'image'
              ? <img className={css.articleImageThumb} src={articleFileUrl(sessionId, file.path)} alt="" />
              : <span className={file.kind === 'html' ? css.htmlFileIcon : css.markdownFileIcon}>{file.kind === 'html' ? '</>' : '#'}</span>}
            <span><strong>{filename(file.path)}</strong><small>{file.label}</small></span>
          </button>
          <Tooltip label="引用到主对话" side="top">
            <button className={css.compactIconButton} type="button" aria-label={`引用 ${filename(file.path)} 到主对话`} onClick={() => { onReferenceFile(file.path) }}><IconLinkOutline16 /></button>
          </Tooltip>
        </div>)}</div>
      </details>)}</div>}
    {selectedFile !== null && <Modal open onClose={() => { setSelectedFile(null) }} title={`${selectedFile.label}预览`} description={selectedFile.path} closeLabel="关闭预览" {...(css.previewModal === undefined ? {} : { className: css.previewModal })} {...(css.previewModalContent === undefined ? {} : { contentClassName: css.previewModalContent })} footer={<><Button variant="toolbar" icon={<IconLinkOutline16 />} onClick={() => { onReferenceFile(selectedFile.path); setSelectedFile(null) }}>引用到对话</Button><Button variant="toolbar" onClick={() => { setSelectedFile(null) }}>关闭</Button></>}>
      <ArticlePreview file={selectedFile} preview={preview} sessionId={sessionId} />
    </Modal>}
  </main>
}
