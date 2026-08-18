import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
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
} from '@deepseek-ai/dsh-subprocess'
import WechatArticleConfiguration from '../src/configuration.js'
import { resolveSkillSourceDir, WECHAT_SKILL_NAMES } from '../src/skill-source.js'

class StubSubprocess extends SubprocessRuntime {
  exitCode = 0
  stdout = 'True\n配置校验通过\n'

  async resolveExecutable(command: string): Promise<string> {
    return `/usr/bin/${command}`
  }

  spawn(_spec: SubprocessSpawnSpec): SubprocessHandle {
    const stdout: SubprocessOutputRead = { text: this.stdout, nextOffset: this.stdout.length, lossy: false }
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
      done: Promise.resolve({ exitCode: this.exitCode, signal: null }),
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
const originalDshHome = process.env.DSH_HOME

afterEach(async () => {
  if (originalDshHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = originalDshHome
  await Promise.all(temporaryRoots.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

async function createSkillSource(): Promise<void> {
  const source = resolveSkillSourceDir()
  await mkdir(join(source, '.git'), { recursive: true })
  for (const name of WECHAT_SKILL_NAMES) {
    const directory = join(source, 'skills', name)
    await mkdir(directory, { recursive: true })
    await writeFile(join(directory, 'SKILL.md'), `---\nname: ${name}\ndescription: Test\n---\n`)
  }
  await mkdir(join(source, 'skills', 'aws-wechat-article-main', 'scripts'), { recursive: true })
  await writeFile(join(source, 'skills', 'aws-wechat-article-main', 'scripts', 'validate_env.py'), '')
  await mkdir(join(source, 'skills', 'aws-wechat-article-assets', 'scripts'), { recursive: true })
  await writeFile(join(source, 'skills', 'aws-wechat-article-assets', 'scripts', 'product_image_ingest.py'), '')
}

async function fixture(config?: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'wechat-configuration-'))
  temporaryRoots.push(root)
  process.env.DSH_HOME = join(root, 'dsh-home')
  await createSkillSource()
  if (config !== undefined) {
    await mkdir(join(root, '.aws-article'), { recursive: true })
    await writeFile(join(root, '.aws-article', 'config.yaml'), config)
    await writeFile(join(root, 'aws.env'), 'WRITING_MODEL_API_KEY=secret\n')
  }
  return root
}

async function service(): Promise<{ ctx: Context; subprocess: StubSubprocess }> {
  const ctx = new Context()
  await ctx.plugin(StubSubprocess)
  const subprocess = ctx.subprocess as StubSubprocess
  await ctx.plugin(WechatArticleConfiguration)
  return { ctx, subprocess }
}

describe('WechatArticleConfiguration', () => {
  it('reports missing project files without running the validator', async () => {
    const root = await fixture()
    const { ctx } = await service()
    await expect(ctx.wechatArticleConfiguration.check(root)).resolves.toEqual({
      state: 'missing',
      ready: false,
      issues: ['缺少 .aws-article/config.yaml', '缺少 aws.env'],
    })
    await ctx.fiber.dispose()
  })

  it('combines upstream validator failures with global account requirements', async () => {
    const root = await fixture('article_category: ""\ntarget_reader: 开发者\ndefault_author: ""\n')
    const { ctx, subprocess } = await service()
    subprocess.exitCode = 1
    subprocess.stdout = 'failed\n图片模型配置不完整\n微信公众号配置不完整\n'
    await expect(ctx.wechatArticleConfiguration.check(root)).resolves.toEqual({
      state: 'invalid',
      ready: false,
      issues: ['账号领域未填写', '默认作者未填写', '图片模型配置不完整', '微信公众号配置不完整'],
    })
    await ctx.fiber.dispose()
  })

  it('unlocks only after the upstream validator and global fields pass', async () => {
    const root = await fixture('article_category: 科技\ntarget_reader: 开发者\ndefault_author: AI Work Skills\n')
    const { ctx } = await service()
    await expect(ctx.wechatArticleConfiguration.check(root)).resolves.toEqual({ state: 'ready', ready: true, issues: [] })
    await expect(ctx.wechatArticleConfiguration.assertReady(root)).resolves.toBeUndefined()
    await ctx.fiber.dispose()
  })
})
