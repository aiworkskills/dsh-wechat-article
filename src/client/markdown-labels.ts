import type { MarkdownLabels } from '@deepseek-ai/dsh-client-ui-primitives'

/**
 * 文档预览里 Markdown 渲染器的固定文案。
 *
 * primitives 0.2.x 起 `MarkdownText` 的 `labels` 变成必填（代码块复制按钮与脚注标题），
 * 0.1.x 时可省略。这里集中一份中文文案，供各预览处复用。
 */
export const previewMarkdownLabels: MarkdownLabels = {
  code: { copyLabel: '复制', copiedLabel: '已复制' },
  footnotes: '脚注',
}
