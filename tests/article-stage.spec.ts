import { describe, expect, it } from 'vitest'
import { deriveArticleStage, stageLabels } from '../src/domain/project/article-stage.js'

describe('deriveArticleStage', () => {
  it('returns published when metadata marks publish completed', () => {
    expect(deriveArticleStage({
      published: true,
      topic: false,
      draft: false,
      article: false,
      html: false,
      cover: false,
      placeholders: false,
    })).toEqual({ stage: 'published', issues: [] })
  })

  it('walks through the upstream workflow gates in order', () => {
    const base = { published: false, topic: true, draft: true, article: true, html: true, cover: true, placeholders: false }
    expect(deriveArticleStage({ ...base, topic: false })).toMatchObject({ stage: 'topic', issues: ['缺少选题卡'] })
    expect(deriveArticleStage({ ...base, draft: false })).toMatchObject({ stage: 'writing', issues: ['缺少初稿'] })
    expect(deriveArticleStage({ ...base, article: false })).toMatchObject({ stage: 'review', issues: ['尚未生成定稿'] })
    expect(deriveArticleStage({ ...base, html: false })).toMatchObject({ stage: 'formatting', issues: ['缺少排版稿'] })
    expect(deriveArticleStage({ ...base, cover: false })).toMatchObject({ stage: 'images', issues: ['缺少封面'] })
    expect(deriveArticleStage({ ...base, placeholders: true })).toMatchObject({ stage: 'images', issues: ['正文配图未完成'] })
    expect(deriveArticleStage(base)).toEqual({ stage: 'publish', issues: [] })
  })

  it('provides localized stage labels for each stage', () => {
    expect(stageLabels('review')).toEqual({ stageLabel: '待内容审', actionLabel: '继续审稿' })
  })
})
