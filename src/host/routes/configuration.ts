import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session'
import {
  CONFIGURATION_EMBED_ROUTE,
  CONFIGURATION_STATUS_ROUTE,
  type ConfigurationEmbedInfo,
} from '../../contracts/configuration.ts'
import { sendJson } from './shared/http.ts'

export interface ConfigurationRouteOptions {
  /** The configuration site this deployment uses, already validated absolute. */
  readonly configurationUrl: string
  /** Which working set this Runtime serves; absent for an ordinary single-workspace install. */
  readonly workspaceId?: string
}

export function registerConfigurationRoutes(ctx: Context, options: ConfigurationRouteOptions): () => void {
  const status = ctx.webServer.register({
    kind: 'exact',
    path: CONFIGURATION_STATUS_ROUTE,
    async handler(req, res) {
      if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET')
        sendJson(res, 405, { error: 'method-not-allowed' })
        return
      }
      const url = new URL(req.url ?? CONFIGURATION_STATUS_ROUTE, 'http://localhost')
      const sessionId = url.searchParams.get('sessionId')?.trim()
      if (!sessionId) {
        sendJson(res, 400, { error: 'sessionId-required' })
        return
      }
      const agent = ctx.agents.get(sessionId as SessionId)
      if (agent === undefined) {
        sendJson(res, 404, { error: 'session-not-active' })
        return
      }
      const workspace = agent.session.header.cwd
      if (workspace === undefined) {
        sendJson(res, 422, { error: 'workspace-required' })
        return
      }
      sendJson(res, 200, await ctx.wechatArticleConfiguration.check(workspace))
    },
  })

  const embed = ctx.webServer.register({
    kind: 'exact',
    path: CONFIGURATION_EMBED_ROUTE,
    handler(req, res) {
      if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET')
        sendJson(res, 405, { error: 'method-not-allowed' })
        return
      }
      sendJson(res, 200, embedInfo(options))
    },
  })

  return () => {
    embed()
    status()
  }
}

/**
 * 空的 workspaceId 意味着「没有第二根轴」，不是一个名字为空的工作集。
 *
 * 这个字段从配置项来，不从环境变量来。它曾经直接读 `process.env.DSHSERVER_WORKSPACE_ID`
 * —— 那个名字属于某一个具体的网关实现，一个通用插件伸手去读它，就等于把那个实现
 * 焊进了自己。部署知道的事由部署告诉插件：profile 里一行 `!!js process.env...` 就够了，
 * 而插件从此不需要知道自己跑在谁的网关下面。
 */
function embedInfo(options: ConfigurationRouteOptions): ConfigurationEmbedInfo {
  const workspaceId = options.workspaceId?.trim()
  return {
    configurationUrl: options.configurationUrl,
    ...(workspaceId === undefined || workspaceId === '' ? {} : { workspaceId }),
  }
}
