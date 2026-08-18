/** @internal Route registration implementation. Use the `/configuration-route` plugin entry instead. */
import type { Context } from '@deepseek-ai/cordis'
import { registerConfigurationRoutes } from './configuration-routes.ts'
import { registerMaterialRoutes } from './material-routes.ts'
import { registerProjectRoutes } from './project-routes.ts'
import { registerSkillSourceRoutes } from './skill-source-routes.ts'

/** Register all workbench HTTP/SSE routes through the WebServer Cordis disposer lifecycle. */
export function registerWorkbenchRoutes(ctx: Context): () => void {
  const eventConnections = new Set<() => void>()
  const disposers = [
    registerConfigurationRoutes(ctx),
    registerProjectRoutes(ctx, eventConnections),
    registerMaterialRoutes(ctx),
    registerSkillSourceRoutes(ctx),
  ]
  return () => {
    eventConnections.forEach(close => { close() })
    disposers.forEach(dispose => { dispose() })
  }
}
