import type { Context } from '@deepseek-ai/cordis'
import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { extname } from 'node:path'
import { ARTICLE_FILE_ROUTE, PROJECT_EVENTS_ROUTE, PROJECT_SNAPSHOT_ROUTE } from '../../contracts/project.ts'
import { watchProjectWorkspace } from '../../domain/project/watch.ts'
import { projectSnapshot, resolveArticleFile } from '../../domain/project/snapshot.ts'
import { fileValidators, imageCacheHeaders, imageContentType, isFresh, sendJson } from './shared/http.ts'
import { sessionWorkspace } from './shared/session.ts'

export function registerProjectRoutes(ctx: Context, eventConnections: Set<() => void>): () => void {
  const disposers = [
    ctx.webServer.register({
      kind: 'exact',
      path: PROJECT_SNAPSHOT_ROUTE,
      async handler(req, res) {
        if (req.method !== 'GET') {
          res.setHeader('Allow', 'GET')
          sendJson(res, 405, { error: 'method-not-allowed' })
          return
        }
        const workspace = sessionWorkspace(ctx, req, PROJECT_SNAPSHOT_ROUTE)
        if (workspace === undefined) {
          sendJson(res, 404, { error: 'session-or-workspace-not-found' })
          return
        }
        try {
          sendJson(res, 200, await projectSnapshot(workspace, ctx.wechatProductLibrary))
        } catch (error) {
          sendJson(res, 500, { error: 'project-snapshot-failed', message: error instanceof Error ? error.message : String(error) })
        }
      },
    }),
    ctx.webServer.register({
      kind: 'exact',
      path: PROJECT_EVENTS_ROUTE,
      async handler(req, res) {
        if (req.method !== 'GET') {
          res.setHeader('Allow', 'GET')
          sendJson(res, 405, { error: 'method-not-allowed' })
          return
        }
        const workspace = sessionWorkspace(ctx, req, PROJECT_EVENTS_ROUTE)
        if (workspace === undefined) {
          sendJson(res, 404, { error: 'session-or-workspace-not-found' })
          return
        }
        res.writeHead(200, {
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'Content-Type': 'text/event-stream; charset=utf-8',
          'X-Accel-Buffering': 'no',
        })
        res.write(': connected\n\n')
        let closed = false
        let stopWatching: (() => void) | undefined
        const keepAlive = setInterval(() => {
          if (!closed && !res.writableEnded) res.write(': keep-alive\n\n')
        }, 25_000)
        const close = (): void => {
          if (closed) return
          closed = true
          clearInterval(keepAlive)
          stopWatching?.()
          eventConnections.delete(close)
          if (!res.writableEnded) res.end()
        }
        eventConnections.add(close)
        req.once('close', close)
        res.once('close', close)
        try {
          stopWatching = await watchProjectWorkspace(workspace, () => {
            if (!closed && !res.writableEnded) res.write('event: change\ndata: {}\n\n')
          })
          if (closed) stopWatching?.()
        } catch {
          close()
        }
      },
    }),
    ctx.webServer.register({
      kind: 'exact',
      path: ARTICLE_FILE_ROUTE,
      async handler(req, res) {
        if (req.method !== 'GET') {
          res.setHeader('Allow', 'GET')
          sendJson(res, 405, { error: 'method-not-allowed' })
          return
        }
        const workspace = sessionWorkspace(ctx, req, ARTICLE_FILE_ROUTE)
        const path = new URL(req.url ?? ARTICLE_FILE_ROUTE, 'http://localhost').searchParams.get('path')
        const resolved = workspace === undefined || path === null ? null : await resolveArticleFile(workspace, path)
        if (resolved === null) {
          sendJson(res, 404, { error: 'article-file-not-found' })
          return
        }
        try {
          const info = await stat(resolved)
          if (!info.isFile() || info.size > 2 * 1024 * 1024) {
            sendJson(res, 404, { error: 'article-file-not-found' })
            return
          }
          const imageType = imageContentType(resolved)
          if (imageType !== undefined) {
            // 智能体随时会重写这些图,所以不设"免问期";带上校验器之后,每次开面板
            // 的代价从"全量重下"降到"一个 304"。
            const cache = imageCacheHeaders(info, 0)
            if (isFresh(req, fileValidators(info))) {
              res.writeHead(304, cache)
              res.end()
              return
            }
            res.writeHead(200, { ...cache, 'Content-Length': info.size, 'Content-Type': imageType })
            createReadStream(resolved).pipe(res)
            return
          }
          const extension = extname(resolved).toLowerCase()
          if (!['.md', '.txt', '.yaml', '.yml', '.html'].includes(extension)) {
            sendJson(res, 404, { error: 'article-file-not-found' })
            return
          }
          sendJson(res, 200, { path, content: await readFile(resolved, 'utf8') })
        } catch {
          sendJson(res, 404, { error: 'article-file-not-found' })
        }
      },
    }),
  ]
  return () => { disposers.forEach(dispose => { dispose() }) }
}
