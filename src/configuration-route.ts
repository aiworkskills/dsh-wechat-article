/** Same-origin Web route exposing the secret-free configuration gate status. */
import type { Context } from '@deepseek-ai/cordis'
import '@deepseek-ai/dsh-agent'
import '@deepseek-ai/dsh-host-webserver'
import './configuration.ts'
import './library.ts'
import './skill-source-service.ts'
import { registerWorkbenchRoutes } from './adapters/host/routes/index.ts'

export {
  ARTICLE_FILE_ROUTE,
  CONFIGURATION_STATUS_ROUTE,
  PRODUCT_CATEGORY_ROUTE,
  PRODUCT_DOCUMENT_ROUTE,
  PRODUCT_IMAGE_INGEST_ROUTE,
  PRODUCT_IMAGE_ROUTE,
  PROJECT_EVENTS_ROUTE,
  PROJECT_SNAPSHOT_ROUTE,
  SKILL_SOURCE_ROUTE,
} from './contracts.ts'

export const name = 'aiworkskills-wechat-configuration-route'
export const inject = ['agents', 'webServer', 'wechatArticleConfiguration', 'wechatProductLibrary', 'wechatSkillSource']

export function apply(ctx: Context): void {
  ctx.effect(() => registerWorkbenchRoutes(ctx), 'wechat-article: workbench routes')
}
