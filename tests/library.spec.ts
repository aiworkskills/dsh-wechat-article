import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess'
import type {
  SubprocessHandle,
  SubprocessOutputRead,
  SubprocessSpawnSpec,
  SubprocessTerminalHandle,
  SubprocessTerminalSpawnSpec,
} from '@deepseek-ai/dsh-subprocess'
import WechatProductLibrary from '../src/library.js'

class StubSubprocess extends SubprocessRuntime {
  lastSpec: SubprocessSpawnSpec | undefined

  async resolveExecutable(command: string): Promise<string> {
    return `/usr/bin/${command}`
  }

  spawn(spec: SubprocessSpawnSpec): SubprocessHandle {
    this.lastSpec = spec
    const stdout: SubprocessOutputRead = { text: '[OK] 图片: saved.png', nextOffset: 24, lossy: false }
    const stderr: SubprocessOutputRead = { text: '', nextOffset: 0, lossy: false }
    return {
      pid: 1,
      stdin: undefined,
      stdout: undefined,
      stderr: undefined,
      collected: {
        stdout: { readFrom: () => stdout },
        stderr: { readFrom: () => stderr },
      },
      done: Promise.resolve({ exitCode: 0, signal: null }),
      terminate: () => {},
      waitForExit: () => Promise.resolve(true),
    }
  }

  async spawnTerminal(): Promise<SubprocessTerminalHandle> {
    return {
      pid: 1,
      output: new PassThrough(),
      done: Promise.resolve({ exitCode: 0, signal: null }),
      write: async () => {},
      inspectForeground: async () => undefined,
      signalForeground: async () => 1,
      terminate: async () => {},
    }
  }
}

const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'wechat-library-'))
  temporaryRoots.push(root)
  const first = join(root, '.aws-article', 'products', '公众号助手')
  const images = join(first, 'images')
  await mkdir(images, { recursive: true })
  await writeFile(join(first, '产品介绍.md'), '# 公众号助手\n\n帮助团队完成公众号写作。\n')
  await writeFile(join(images, '配置首页.png'), 'fake image bytes')
  await writeFile(join(images, '配置首页.md'), '**图片路径**：`.aws-article/products/公众号助手/images/配置首页.png`\n\n**图片描述**：配置平台首页，展示主题与字体选项。\n')
  await writeFile(join(images, '无说明.jpg'), 'fake image bytes')
  return root
}

async function library(): Promise<{ ctx: Context; subprocess: StubSubprocess }> {
  const ctx = new Context()
  await ctx.plugin(StubSubprocess)
  const subprocess = ctx.subprocess as StubSubprocess
  await ctx.plugin(WechatProductLibrary, {
    maxResults: 10,
    maxDocumentBytes: 4096,
  })
  return { ctx, subprocess }
}

describe('WechatProductLibrary', () => {
  it('lists product counts without treating image sidecars as knowledge documents', async () => {
    const root = await fixture()
    const { ctx } = await library()
    await expect(ctx.wechatProductLibrary.listProducts(root)).resolves.toEqual([
      { name: '公众号助手', documentCount: 1, imageCount: 2 },
    ])
    await ctx.fiber.dispose()
  })

  it('searches product knowledge and image descriptions with relative paths', async () => {
    const root = await fixture()
    const { ctx } = await library()
    const documents = await ctx.wechatProductLibrary.findDocuments(root, { query: '团队' })
    expect(documents).toEqual([expect.objectContaining({
      product: '公众号助手',
      path: '.aws-article/products/公众号助手/产品介绍.md',
      title: '公众号助手',
    })])
    const images = await ctx.wechatProductLibrary.findImages(root, { query: '字体' })
    expect(images).toEqual([{
      product: '公众号助手',
      imagePath: '.aws-article/products/公众号助手/images/配置首页.png',
      descriptionPath: '.aws-article/products/公众号助手/images/配置首页.md',
      description: '配置平台首页，展示主题与字体选项。',
    }])
    await ctx.fiber.dispose()
  })

  it('delegates image ingestion to the Git-installed Skill script with argv isolation', async () => {
    const root = await fixture()
    const { ctx, subprocess } = await library()
    await expect(ctx.wechatProductLibrary.ingestImage({
      workspace: root,
      sourcePath: '/tmp/user image.png',
      product: '公众号助手',
      stem: '配置首页',
      content: '配置平台首页。',
    })).resolves.toEqual({ output: '[OK] 图片: saved.png' })
    expect(subprocess.lastSpec?.argv.some(value => value.endsWith('/product_image_ingest.py'))).toBe(true)
    expect(subprocess.lastSpec?.argv).toContain('/tmp/user image.png')
    expect(subprocess.lastSpec?.argv).toContain('--content')
    expect(subprocess.lastSpec?.cwd).toBe(root)
    await ctx.fiber.dispose()
  })

  it('creates manual product documents at the Skill-defined product root and preserves the images directory', async () => {
    const root = await fixture()
    const { ctx } = await library()
    await expect(ctx.wechatProductLibrary.createDocument({
      workspace: root,
      product: '新产品',
      filename: '服务介绍',
      content: '# 新产品\n\n一段已确认的业务介绍。',
    })).resolves.toEqual({ path: '.aws-article/products/新产品/服务介绍.md' })
    await expect(readFile(join(root, '.aws-article', 'products', '新产品', '服务介绍.md'), 'utf8')).resolves.toContain('已确认的业务介绍')
    expect((await stat(join(root, '.aws-article', 'products', '新产品', 'images'))).isDirectory()).toBe(true)
    await ctx.fiber.dispose()
  })

  it('creates a new product skeleton for multi-product material libraries', async () => {
    const root = await fixture()
    const { ctx } = await library()
    await expect(ctx.wechatProductLibrary.createProduct({ workspace: root, product: '第二个产品' })).resolves.toEqual({
      path: '.aws-article/products/第二个产品',
    })
    expect((await stat(join(root, '.aws-article', 'products', '第二个产品', 'images'))).isDirectory()).toBe(true)
    await expect(ctx.wechatProductLibrary.createProduct({ workspace: root, product: '第二个产品' })).rejects.toThrow('同名素材文件夹已存在')
    await ctx.fiber.dispose()
  })

  it('renames a product folder with all nested materials', async () => {
    const root = await fixture()
    const { ctx } = await library()
    await expect(ctx.wechatProductLibrary.renameProduct({ workspace: root, product: '公众号助手', nextProduct: '内容运营助手' })).resolves.toEqual({
      path: '.aws-article/products/内容运营助手',
    })
    await expect(readFile(join(root, '.aws-article', 'products', '内容运营助手', '产品介绍.md'), 'utf8')).resolves.toContain('公众号助手')
    expect((await stat(join(root, '.aws-article', 'products', '内容运营助手', 'images', '配置首页.png'))).isFile()).toBe(true)
    await ctx.fiber.dispose()
  })

  it('renames a product document while preserving its content', async () => {
    const root = await fixture()
    const { ctx } = await library()
    await expect(ctx.wechatProductLibrary.renameDocument({
      workspace: root,
      product: '公众号助手',
      filename: '产品介绍.md',
      nextFilename: '能力说明',
    })).resolves.toEqual({ path: '.aws-article/products/公众号助手/能力说明.md' })
    await expect(readFile(join(root, '.aws-article', 'products', '公众号助手', '能力说明.md'), 'utf8')).resolves.toContain('帮助团队完成公众号写作')
    await expect(stat(join(root, '.aws-article', 'products', '公众号助手', '产品介绍.md'))).rejects.toMatchObject({ code: 'ENOENT' })
    await ctx.fiber.dispose()
  })

  it('renames an image and its description sidecar together', async () => {
    const root = await fixture()
    const { ctx } = await library()
    await expect(ctx.wechatProductLibrary.renameImage({
      workspace: root,
      product: '公众号助手',
      filename: '配置首页.png',
      nextFilename: '主题配置.png',
    })).resolves.toEqual({ path: '.aws-article/products/公众号助手/images/主题配置.png' })
    expect((await stat(join(root, '.aws-article', 'products', '公众号助手', 'images', '主题配置.png'))).isFile()).toBe(true)
    await expect(readFile(join(root, '.aws-article', 'products', '公众号助手', 'images', '主题配置.md'), 'utf8')).resolves.toContain('images/主题配置.png')
    await expect(stat(join(root, '.aws-article', 'products', '公众号助手', 'images', '配置首页.md'))).rejects.toMatchObject({ code: 'ENOENT' })
    await ctx.fiber.dispose()
  })

  it('deletes product documents and images within the Skill library', async () => {
    const root = await fixture()
    const { ctx } = await library()
    await expect(ctx.wechatProductLibrary.deleteDocument({ workspace: root, product: '公众号助手', filename: '产品介绍.md' })).resolves.toBeUndefined()
    await expect(stat(join(root, '.aws-article', 'products', '公众号助手', '产品介绍.md'))).rejects.toMatchObject({ code: 'ENOENT' })

    await expect(ctx.wechatProductLibrary.deleteImage({ workspace: root, product: '公众号助手', filename: '配置首页.png' })).resolves.toBeUndefined()
    await expect(stat(join(root, '.aws-article', 'products', '公众号助手', 'images', '配置首页.png'))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(stat(join(root, '.aws-article', 'products', '公众号助手', 'images', '配置首页.md'))).rejects.toMatchObject({ code: 'ENOENT' })
    await ctx.fiber.dispose()
  })
})
