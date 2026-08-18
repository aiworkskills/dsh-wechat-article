import type { ArticleFileSummary } from '../../../project-contract.ts'
import { articleFileUrl } from '../../project-snapshot.ts'
import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import { filename } from './format.ts'
import css from '../../workbench.module.css'

export type Preview = { readonly phase: 'idle' } | { readonly phase: 'loading' } | { readonly phase: 'ready'; readonly content: string } | { readonly phase: 'error'; readonly message: string }

export function markdownForPreview(content: string): string {
  return content.replace(/^!\[([^\]]*)\]\(placeholder\)\s*$/gmu, '> 配图占位：$1')
}

export function htmlForPreview(content: string, file: ArticleFileSummary, sessionId: string): string {
  const document = new DOMParser().parseFromString(content, 'text/html')
  document.querySelectorAll('script, base, meta[http-equiv="refresh"]').forEach(element => { element.remove() })
  const articleDirectory = file.path.slice(0, Math.max(0, file.path.lastIndexOf('/')))
  document.querySelectorAll('img[src]').forEach(image => {
    const source = image.getAttribute('src')?.trim() ?? ''
    if (source === 'placeholder') {
      const placeholder = document.createElement('div')
      placeholder.textContent = `配图占位：${image.getAttribute('alt')?.trim() || '等待配图'}`
      placeholder.setAttribute('style', 'margin:16px 0;padding:18px;border:1px dashed #aaa;text-align:center;color:#777;font-size:13px;')
      image.replaceWith(placeholder)
      return
    }
    if (source === '' || /^(?:data:|blob:|https?:|#)/iu.test(source)) return
    const resolved = new URL(source, `https://article-preview.invalid/${articleDirectory}/`).pathname.slice(1)
    image.setAttribute('src', articleFileUrl(sessionId, decodeURIComponent(resolved)))
  })
  return `<!doctype html>${document.documentElement.outerHTML}`
}

export function ArticlePreview({ file, preview, sessionId }: { readonly file: ArticleFileSummary; readonly preview: Preview; readonly sessionId: string }) {
  if (file.kind === 'image') return <figure className={css.articleImagePreview}><img src={articleFileUrl(sessionId, file.path)} alt={filename(file.path)} /><figcaption>{filename(file.path)}</figcaption></figure>
  if (preview.phase === 'loading') return <div className={css.previewState}>正在读取文件</div>
  if (preview.phase === 'error') return <div className={css.operationError}>{preview.message}</div>
  if (preview.phase !== 'ready') return <div className={css.previewState}>文件尚未生成</div>
  if (file.kind === 'html') return <iframe className={css.htmlPreviewModalFrame} srcDoc={htmlForPreview(preview.content, file, sessionId)} title="公众号排版预览" sandbox="" />
  return <article className={css.markdownPreviewModal}><MarkdownText text={markdownForPreview(preview.content)} /></article>
}
