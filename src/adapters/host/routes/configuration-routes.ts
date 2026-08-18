import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session'
import { CONFIGURATION_STATUS_ROUTE } from '../../../configuration-contract.ts'
import { sendJson } from './shared/http.ts'

export function registerConfigurationRoutes(ctx: Context): () => void {
  return ctx.webServer.register({
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
}
