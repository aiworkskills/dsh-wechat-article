import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session'
import {
  CONFIGURATION_EMBED_ROUTE,
  CONFIGURATION_STATUS_ROUTE,
  type ConfigurationEmbedInfo,
} from '../../../configuration-contract.ts'
import { sendJson } from './shared/http.ts'

export interface ConfigurationRouteOptions {
  /** The configuration site this deployment uses, already validated absolute. */
  readonly configurationUrl: string
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
      sendJson(res, 200, embedInfo(options.configurationUrl))
    },
  })

  return () => {
    embed()
    status()
  }
}

/**
 * `DSHSERVER_WORKSPACE_ID` is set by a Runtime Gateway that gives each working
 * set its own Runtime. A plain local install has no such variable and gets an
 * answer without the field, which is what tells the configuration site that
 * nothing is being constrained.
 */
function embedInfo(configurationUrl: string): ConfigurationEmbedInfo {
  const workspaceId = process.env.DSHSERVER_WORKSPACE_ID?.trim()
  return {
    configurationUrl,
    ...(workspaceId === undefined || workspaceId === '' ? {} : { workspaceId }),
  }
}
