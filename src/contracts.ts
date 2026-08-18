/** Shared contracts subpath (`@aiworkskills/aws-wechat-article/contracts`). */

export {
  CONFIGURATION_STATUS_ROUTE,
  type ConfigurationState,
  type ConfigurationStatus,
} from './configuration-contract.ts'

export {
  ARTICLE_FILE_ROUTE,
  PRODUCT_CATEGORY_ROUTE,
  PRODUCT_DOCUMENT_ROUTE,
  PRODUCT_IMAGE_INGEST_ROUTE,
  PRODUCT_IMAGE_ROUTE,
  PROJECT_EVENTS_ROUTE,
  PROJECT_SNAPSHOT_ROUTE,
  type ArticleFileKind,
  type ArticleFileSummary,
  type ArticleStage,
  type ArticleSummary,
  type ProductDocumentSummary,
  type ProductImageSummary,
  type ProjectSnapshot,
} from './project-contract.ts'

export {
  SKILL_SOURCE_ROUTE,
  type SkillSourceState,
  type SkillSourceStatus,
} from './skill-source-contract.ts'
