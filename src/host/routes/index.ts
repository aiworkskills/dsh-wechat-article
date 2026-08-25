/**
 * Same-origin Web routes backing the browser workbench.
 *
 * 一个 Cordis 插件，由 `src/index.ts` 组合。它自己不拥有任何状态：状态在三个服务
 * 里，这里只是把它们摆到 HTTP 上，并跟着 WebServer 的 disposer 生命周期一起卸载。
 */
import type { Context } from '@deepseek-ai/cordis'
// 类型导入，不是副作用导入：这几行要的是 `declare module '@deepseek-ai/cordis'`
// 里的服务声明，而值层面它们已经由 src/index.ts 装配好了。写成裸 import 会在编译
// 产物里留下真实的 import 语句 —— 插件以 link 方式进 profile 时那几个包不在它的
// node_modules 里，Runtime 会以 ERR_MODULE_NOT_FOUND 直接起不来。
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '../configuration.ts'
import type {} from '../library.ts'
import type {} from '../skill-source.ts'
import { registerConfigurationRoutes } from './configuration.ts'
import { registerMaterialRoutes } from './material.ts'
import { registerProjectRoutes } from './project.ts'
import { registerSkillSourceRoutes } from './skill-source.ts'

export const name = 'aiworkskills-wechat-workbench-routes'
export const inject = ['agents', 'webServer', 'wechatArticleConfiguration', 'wechatProductLibrary', 'wechatSkillSource', 'wechatThumbnails']

export interface RouteOptions {
  /** The configuration site this deployment uses; the browser half reads it from here. */
  readonly configurationUrl: string
  /** Which working set this Runtime serves, when the deployment confines it to one. */
  readonly workspaceId?: string
  /** What to call the workbench in the sidebar; absent means the plugin's own name. */
  readonly workbenchLabel?: string
}

export function apply(ctx: Context, options: RouteOptions): void {
  ctx.effect(() => registerWorkbenchRoutes(ctx, options), 'wechat-article: workbench routes')
}

/** @internal Exported for tests; `apply` is the composition entry. */
export function registerWorkbenchRoutes(ctx: Context, options: RouteOptions): () => void {
  const eventConnections = new Set<() => void>()
  const disposers = [
    registerConfigurationRoutes(ctx, options),
    registerProjectRoutes(ctx, eventConnections),
    registerMaterialRoutes(ctx),
    registerSkillSourceRoutes(ctx),
  ]
  return () => {
    eventConnections.forEach(close => { close() })
    disposers.forEach(dispose => { dispose() })
  }
}
