import type { ArticleStage, ArticleSummary } from '../../project-contract.ts'

export interface ArticleArtifacts {
  readonly published: boolean
  readonly topic: boolean
  readonly draft: boolean
  readonly article: boolean
  readonly html: boolean
  readonly cover: boolean
  readonly placeholders: boolean
}

/** Derive workflow stage and blocking issues from article artifacts. */
export function deriveArticleStage(artifacts: ArticleArtifacts): { readonly stage: ArticleStage; readonly issues: string[] } {
  const issues: string[] = []
  let stage: ArticleStage
  if (artifacts.published) {
    stage = 'published'
  } else if (!artifacts.topic) {
    stage = 'topic'
    issues.push('缺少选题卡')
  } else if (!artifacts.draft) {
    stage = 'writing'
    issues.push('缺少初稿')
  } else if (!artifacts.article) {
    stage = 'review'
    issues.push('尚未生成定稿')
  } else if (!artifacts.html) {
    stage = 'formatting'
    issues.push('缺少排版稿')
  } else if (!artifacts.cover || artifacts.placeholders) {
    stage = 'images'
    if (!artifacts.cover) issues.push('缺少封面')
    if (artifacts.placeholders) issues.push('正文配图未完成')
  } else {
    stage = 'publish'
  }
  return { stage, issues }
}

export function stageLabels(stage: ArticleStage): Pick<ArticleSummary, 'stageLabel' | 'actionLabel'> {
  switch (stage) {
    case 'topic': return { stageLabel: '待选题', actionLabel: '继续选题' }
    case 'writing': return { stageLabel: '待写初稿', actionLabel: '继续写作' }
    case 'review': return { stageLabel: '待内容审', actionLabel: '继续审稿' }
    case 'formatting': return { stageLabel: '待排版', actionLabel: '继续排版' }
    case 'images': return { stageLabel: '待配图', actionLabel: '继续配图' }
    case 'publish': return { stageLabel: '待发布', actionLabel: '继续发布' }
    case 'published': return { stageLabel: '已发布', actionLabel: '查看文章' }
  }
}
