import type { Context } from '@deepseek-ai/cordis'
import { SKILL_SOURCE_ROUTE } from '../../contracts/skill-source.ts'
import { requireSameOrigin, sendJson } from './shared/http.ts'

export function registerSkillSourceRoutes(ctx: Context): () => void {
  return ctx.webServer.register({
    kind: 'exact',
    path: SKILL_SOURCE_ROUTE,
    async handler(req, res) {
      if (req.method === 'GET') {
        sendJson(res, 200, await ctx.wechatSkillSource.status())
        return
      }
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'GET, POST')
        sendJson(res, 405, { error: 'method-not-allowed' })
        return
      }
      if (!requireSameOrigin(req)) {
        sendJson(res, 403, { error: 'cross-origin-install-rejected' })
        return
      }
      try {
        sendJson(res, 200, await ctx.wechatSkillSource.synchronize())
      } catch (error) {
        sendJson(res, 500, {
          error: 'skill-sync-failed',
          message: error instanceof Error ? error.message : String(error),
        })
      }
    },
  })
}
