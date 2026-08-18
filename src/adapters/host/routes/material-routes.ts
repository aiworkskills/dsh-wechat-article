import type { Context } from '@deepseek-ai/cordis'
import { createReadStream } from 'node:fs'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { mapRouteError } from '../../../domain/errors.ts'
import { resolveProductDocumentPath, resolveProductImagePath } from '../../../domain/paths/workspace-paths.ts'
import { PRODUCT_CATEGORY_ROUTE, PRODUCT_DOCUMENT_ROUTE, PRODUCT_IMAGE_INGEST_ROUTE, PRODUCT_IMAGE_ROUTE } from '../../../project-contract.ts'
import { imageContentType, imagePayload, readJson, requireSameOrigin, sendJson, textField } from './shared/http.ts'
import { sessionWorkspace } from './shared/session.ts'

export function registerMaterialRoutes(ctx: Context): () => void {
  const disposers = [
    ctx.webServer.register({
      kind: 'exact',
      path: PRODUCT_IMAGE_ROUTE,
      async handler(req, res) {
        if (req.method === 'PATCH' || req.method === 'DELETE') {
          if (!requireSameOrigin(req)) {
            sendJson(res, 403, { error: 'cross-origin-write-rejected' })
            return
          }
          const workspace = sessionWorkspace(ctx, req, PRODUCT_IMAGE_ROUTE)
          if (workspace === undefined) {
            sendJson(res, 404, { error: 'session-or-workspace-not-found' })
            return
          }
          try {
            const body = await readJson(req, 8_192)
            await ctx.wechatArticleConfiguration.assertReady(workspace)
            if (req.method === 'DELETE') {
              await ctx.wechatProductLibrary.deleteImage({
                workspace,
                product: textField(body, 'product'),
                filename: textField(body, 'filename'),
              })
              sendJson(res, 200, { deleted: true })
              return
            }
            sendJson(res, 200, await ctx.wechatProductLibrary.renameImage({
              workspace,
              product: textField(body, 'product'),
              filename: textField(body, 'filename'),
              nextFilename: textField(body, 'nextFilename'),
            }))
          } catch (error) {
            const mapped = mapRouteError(error, 'product-image-rename-failed')
            sendJson(res, mapped.status, mapped.body)
          }
          return
        }
        if (req.method !== 'GET') {
          res.setHeader('Allow', 'GET, PATCH, DELETE')
          sendJson(res, 405, { error: 'method-not-allowed' })
          return
        }
        const workspace = sessionWorkspace(ctx, req, PRODUCT_IMAGE_ROUTE)
        const path = new URL(req.url ?? PRODUCT_IMAGE_ROUTE, 'http://localhost').searchParams.get('path')
        const resolved = workspace === undefined || path === null ? null : resolveProductImagePath(workspace, path)
        const contentType = resolved === null ? undefined : imageContentType(resolved)
        if (resolved === null || contentType === undefined) {
          sendJson(res, 404, { error: 'image-not-found' })
          return
        }
        try {
          const info = await stat(resolved)
          if (!info.isFile() || info.size > 10 * 1024 * 1024) {
            sendJson(res, 404, { error: 'image-not-found' })
            return
          }
          res.writeHead(200, { 'Cache-Control': 'private, max-age=300', 'Content-Length': info.size, 'Content-Type': contentType })
          createReadStream(resolved).pipe(res)
        } catch {
          sendJson(res, 404, { error: 'image-not-found' })
        }
      },
    }),
    ctx.webServer.register({
      kind: 'exact',
      path: PRODUCT_DOCUMENT_ROUTE,
      async handler(req, res) {
        if (req.method === 'GET') {
          const workspace = sessionWorkspace(ctx, req, PRODUCT_DOCUMENT_ROUTE)
          const path = new URL(req.url ?? PRODUCT_DOCUMENT_ROUTE, 'http://localhost').searchParams.get('path')
          const resolved = workspace === undefined || path === null ? null : resolveProductDocumentPath(workspace, path)
          if (resolved === null) {
            sendJson(res, 404, { error: 'product-document-not-found' })
            return
          }
          try {
            const info = await stat(resolved)
            if (!info.isFile() || info.size > 1024 * 1024) {
              sendJson(res, 404, { error: 'product-document-not-found' })
              return
            }
            sendJson(res, 200, { path, content: await readFile(resolved, 'utf8') })
          } catch {
            sendJson(res, 404, { error: 'product-document-not-found' })
          }
          return
        }
        if (req.method !== 'POST' && req.method !== 'PATCH' && req.method !== 'DELETE') {
          res.setHeader('Allow', 'GET, POST, PATCH, DELETE')
          sendJson(res, 405, { error: 'method-not-allowed' })
          return
        }
        if (!requireSameOrigin(req)) {
          sendJson(res, 403, { error: 'cross-origin-write-rejected' })
          return
        }
        const workspace = sessionWorkspace(ctx, req, PRODUCT_DOCUMENT_ROUTE)
        if (workspace === undefined) {
          sendJson(res, 404, { error: 'session-or-workspace-not-found' })
          return
        }
        try {
          const body = await readJson(req, 1_100_000)
          await ctx.wechatArticleConfiguration.assertReady(workspace)
          if (req.method === 'DELETE') {
            await ctx.wechatProductLibrary.deleteDocument({
              workspace,
              product: textField(body, 'product'),
              filename: textField(body, 'filename'),
            })
            sendJson(res, 200, { deleted: true })
            return
          }
          if (req.method === 'PATCH') {
            sendJson(res, 200, await ctx.wechatProductLibrary.renameDocument({
              workspace,
              product: textField(body, 'product'),
              filename: textField(body, 'filename'),
              nextFilename: textField(body, 'nextFilename'),
            }))
            return
          }
          sendJson(res, 201, await ctx.wechatProductLibrary.createDocument({
            workspace,
            product: textField(body, 'product'),
            filename: textField(body, 'filename'),
            content: textField(body, 'content'),
          }))
        } catch (error) {
          const mapped = mapRouteError(error, 'product-document-write-failed')
          sendJson(res, mapped.status, mapped.body)
        }
      },
    }),
    ctx.webServer.register({
      kind: 'exact',
      path: PRODUCT_CATEGORY_ROUTE,
      async handler(req, res) {
        if (req.method !== 'POST' && req.method !== 'PATCH') {
          res.setHeader('Allow', 'POST, PATCH')
          sendJson(res, 405, { error: 'method-not-allowed' })
          return
        }
        if (!requireSameOrigin(req)) {
          sendJson(res, 403, { error: 'cross-origin-write-rejected' })
          return
        }
        const workspace = sessionWorkspace(ctx, req, PRODUCT_CATEGORY_ROUTE)
        if (workspace === undefined) {
          sendJson(res, 404, { error: 'session-or-workspace-not-found' })
          return
        }
        try {
          const body = await readJson(req, 8_192)
          await ctx.wechatArticleConfiguration.assertReady(workspace)
          if (req.method === 'PATCH') {
            sendJson(res, 200, await ctx.wechatProductLibrary.renameProduct({ workspace, product: textField(body, 'product'), nextProduct: textField(body, 'nextProduct') }))
          } else {
            sendJson(res, 201, await ctx.wechatProductLibrary.createProduct({ workspace, product: textField(body, 'product') }))
          }
        } catch (error) {
          const mapped = mapRouteError(error, 'product-category-create-failed')
          sendJson(res, mapped.status, mapped.body)
        }
      },
    }),
    ctx.webServer.register({
      kind: 'exact',
      path: PRODUCT_IMAGE_INGEST_ROUTE,
      async handler(req, res) {
        if (req.method !== 'POST') {
          res.setHeader('Allow', 'POST')
          sendJson(res, 405, { error: 'method-not-allowed' })
          return
        }
        if (!requireSameOrigin(req)) {
          sendJson(res, 403, { error: 'cross-origin-write-rejected' })
          return
        }
        const workspace = sessionWorkspace(ctx, req, PRODUCT_IMAGE_INGEST_ROUTE)
        if (workspace === undefined) {
          sendJson(res, 404, { error: 'session-or-workspace-not-found' })
          return
        }
        let temporaryPath: string | undefined
        try {
          const body = await readJson(req, 14 * 1024 * 1024)
          const image = imagePayload(textField(body, 'dataUrl'))
          await ctx.wechatArticleConfiguration.assertReady(workspace)
          const tempRoot = join(workspace, '.aws-article', 'tmp')
          await mkdir(tempRoot, { recursive: true })
          temporaryPath = join(tempRoot, `plugin-upload-${Date.now()}-${Math.random().toString(16).slice(2)}${image.extension}`)
          await writeFile(temporaryPath, image.data, { flag: 'wx' })
          sendJson(res, 201, await ctx.wechatProductLibrary.ingestImage({
            workspace,
            sourcePath: temporaryPath,
            product: textField(body, 'product'),
            stem: textField(body, 'stem'),
            content: textField(body, 'description'),
          }))
        } catch (error) {
          const mapped = mapRouteError(error, 'product-image-ingest-failed')
          sendJson(res, mapped.status, mapped.body)
        } finally {
          if (temporaryPath !== undefined) await rm(temporaryPath, { force: true })
        }
      },
    }),
  ]
  return () => { disposers.forEach(dispose => { dispose() }) }
}
