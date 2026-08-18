import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { registerConfigurationRoutes } from '../src/adapters/host/routes/configuration-routes.ts'
import { registerProjectRoutes } from '../src/adapters/host/routes/project-routes.ts'
import { CONFIGURATION_STATUS_ROUTE } from '../src/configuration-contract.ts'
import { PROJECT_SNAPSHOT_ROUTE } from '../src/project-contract.ts'
import type { ConfigurationStatus } from '../src/configuration-contract.ts'

const roots: string[] = []

type RouteHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void> | void

function mockResponse(): { readonly res: ServerResponse; statusCode: number; body: string } {
  const state = { statusCode: 0, body: '' }
  const res = {
    statusCode: 0,
    writableEnded: false,
    setHeader(_name: string, _value: string | number | readonly string[]) {},
    writeHead(status: number, _headers?: Record<string, string | number>) {
      state.statusCode = status
      res.statusCode = status
    },
    end(chunk?: unknown) {
      if (typeof chunk === 'string') state.body = chunk
      else if (Buffer.isBuffer(chunk)) state.body = chunk.toString('utf8')
    },
    write(chunk: unknown) {
      if (typeof chunk === 'string') state.body += chunk
      return true
    },
    once() { return this },
    pipe() { return this },
  } as unknown as ServerResponse
  return {
    res,
    get statusCode() { return state.statusCode },
    get body() { return state.body },
  }
}

function createRouteRegistry(): { readonly routes: Map<string, RouteHandler>; readonly register: Context['webServer']['register'] } {
  const routes = new Map<string, RouteHandler>()
  return {
    routes,
    register: spec => {
      routes.set(spec.path, spec.handler as RouteHandler)
      return () => { routes.delete(spec.path) }
    },
  }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('workbench routes', () => {
  it('returns configuration status for an active session workspace', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'wechat-route-'))
    roots.push(workspace)
    const registry = createRouteRegistry()
    const status: ConfigurationStatus = { state: 'ready', ready: true, issues: [] }
    const ctx = {
      webServer: { register: registry.register },
      agents: { get: () => ({ session: { header: { cwd: workspace } } }) },
      wechatArticleConfiguration: { check: async () => status },
    } as unknown as Context
    registerConfigurationRoutes(ctx)
    const handler = registry.routes.get(CONFIGURATION_STATUS_ROUTE)
    expect(handler).toBeDefined()
    const mock = mockResponse()
    await handler!({ method: 'GET', url: `${CONFIGURATION_STATUS_ROUTE}?sessionId=s1` } as IncomingMessage, mock.res)
    expect(mock.statusCode).toBe(200)
    expect(JSON.parse(mock.body)).toEqual(status)
  })

  it('rejects configuration status without sessionId', async () => {
    const registry = createRouteRegistry()
    const ctx = {
      webServer: { register: registry.register },
      agents: { get: () => undefined },
      wechatArticleConfiguration: { check: async () => ({ state: 'missing', ready: false, issues: [] }) },
    } as unknown as Context
    registerConfigurationRoutes(ctx)
    const handler = registry.routes.get(CONFIGURATION_STATUS_ROUTE)!
    const mock = mockResponse()
    await handler({ method: 'GET', url: CONFIGURATION_STATUS_ROUTE } as IncomingMessage, mock.res)
    expect(mock.statusCode).toBe(400)
    expect(JSON.parse(mock.body)).toMatchObject({ error: 'sessionId-required' })
  })

  it('returns project snapshot for a configured workspace', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'wechat-route-'))
    roots.push(workspace)
    await mkdir(join(workspace, '.aws-article', 'products', 'DSH', 'images'), { recursive: true })
    await writeFile(join(workspace, '.aws-article', 'config.yaml'), 'drafts_root: drafts\n')
    const registry = createRouteRegistry()
    const library = {
      listProducts: async () => [{ name: 'DSH', documentCount: 0, imageCount: 0 }],
      findDocuments: async () => [],
      findImages: async () => [],
    }
    const ctx = {
      webServer: { register: registry.register },
      agents: { get: () => ({ session: { header: { cwd: workspace } } }) },
      wechatProductLibrary: library,
    } as unknown as Context
    registerProjectRoutes(ctx, new Set())
    const handler = registry.routes.get(PROJECT_SNAPSHOT_ROUTE)!
    const mock = mockResponse()
    await handler({ method: 'GET', url: `${PROJECT_SNAPSHOT_ROUTE}?sessionId=s1` } as IncomingMessage, mock.res)
    expect(mock.statusCode).toBe(200)
    const payload = JSON.parse(mock.body) as { products: readonly { name: string }[] }
    expect(payload.products).toEqual([{ name: 'DSH', documentCount: 0, imageCount: 0 }])
  })
})
