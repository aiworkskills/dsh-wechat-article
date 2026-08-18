/** Client-safe project data derived from the current session workspace. */
export const PROJECT_SNAPSHOT_ROUTE = '/plugins/aiworkskills/wechat-article/project-snapshot'
export const PROJECT_EVENTS_ROUTE = '/plugins/aiworkskills/wechat-article/project-events'
export const PRODUCT_IMAGE_ROUTE = '/plugins/aiworkskills/wechat-article/product-image'
export const ARTICLE_FILE_ROUTE = '/plugins/aiworkskills/wechat-article/article-file'
export const PRODUCT_DOCUMENT_ROUTE = '/plugins/aiworkskills/wechat-article/product-document'
export const PRODUCT_CATEGORY_ROUTE = '/plugins/aiworkskills/wechat-article/product-category'
export const PRODUCT_IMAGE_INGEST_ROUTE = '/plugins/aiworkskills/wechat-article/product-image-ingest'

export type ArticleStage = 'topic' | 'writing' | 'review' | 'formatting' | 'images' | 'publish' | 'published'

export interface ArticleSummary {
  readonly path: string
  readonly title: string
  readonly updatedAt: string
  readonly stage: ArticleStage
  readonly stageLabel: string
  readonly actionLabel: string
  readonly issues: readonly string[]
  readonly files: readonly ArticleFileSummary[]
}

export type ArticleFileKind = 'markdown' | 'yaml' | 'html' | 'image'

export interface ArticleFileSummary {
  /** Workspace-relative path used for preview and @ references. */
  readonly path: string
  /** Path relative to this article directory. */
  readonly label: string
  readonly kind: ArticleFileKind
}

export interface ProductDocumentSummary {
  readonly product: string
  readonly path: string
  readonly title: string
  readonly excerpt: string
}

export interface ProductImageSummary {
  readonly product: string
  readonly path: string
  readonly description: string
  readonly hasDescription: boolean
}

export interface ProjectSnapshot {
  readonly articles: readonly ArticleSummary[]
  readonly products: readonly {
    readonly name: string
    readonly documentCount: number
    readonly imageCount: number
  }[]
  readonly documents: readonly ProductDocumentSummary[]
  readonly images: readonly ProductImageSummary[]
}
