import type { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage } from 'node:http'
import type { SessionId } from '@deepseek-ai/dsh-session'

/** Resolve the workspace directory for a session-scoped route request. */
export function sessionWorkspace(ctx: Context, req: IncomingMessage, route: string): string | undefined {
  const url = new URL(req.url ?? route, 'http://localhost')
  const sessionId = url.searchParams.get('sessionId')?.trim()
  if (!sessionId) return undefined
  return ctx.agents.get(sessionId as SessionId)?.session.header.cwd
}
