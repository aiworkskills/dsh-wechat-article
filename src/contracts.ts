/** Shared contracts subpath (`@aiworkskills/aws-wechat-article/contracts`). */

export {
  CONFIGURATION_EMBED_ROUTE,
  CONFIGURATION_STATUS_ROUTE,
  type ConfigurationEmbedInfo,
  type ConfigurationState,
  type ConfigurationStatus,
} from './contracts/configuration.ts'

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
} from './contracts/project.ts'

export {
  SKILL_SOURCE_ROUTE,
  type SkillSourceState,
  type SkillSourceStatus,
} from './contracts/skill-source.ts'

export { WORKBENCH_DETAILS_PRIORITY } from './contracts/workbench.ts'
