import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { SkillRegistry } from '@deepseek-ai/dsh-skill'
import {
  SubprocessRuntime,
  type SubprocessHandle,
  type SubprocessSpawnSpec,
  type SubprocessTerminalHandle,
} from '@deepseek-ai/dsh-subprocess'
import * as skillsPlugin from '../src/skills.js'
import { resolveSkillSourceDir, WECHAT_SKILL_NAMES } from '../src/skill-source.js'

const temporaryRoots: string[] = []
const originalDshHome = process.env.DSH_HOME

afterEach(async () => {
  if (originalDshHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = originalDshHome
  await Promise.all(temporaryRoots.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

async function createCheckout(root: string): Promise<void> {
  await mkdir(join(root, '.git'), { recursive: true })
  for (const name of WECHAT_SKILL_NAMES) {
    const directory = join(root, 'skills', name)
    await mkdir(directory, { recursive: true })
    await writeFile(join(directory, 'SKILL.md'), `---\nname: ${name}\ndescription: Test ${name}\n---\n\nBody for ${name}.\n`)
  }
  await mkdir(join(root, 'skills', 'aws-wechat-article-main', 'scripts'), { recursive: true })
  await writeFile(join(root, 'skills', 'aws-wechat-article-main', 'scripts', 'validate_env.py'), '')
  await mkdir(join(root, 'skills', 'aws-wechat-article-assets', 'scripts'), { recursive: true })
  await writeFile(join(root, 'skills', 'aws-wechat-article-assets', 'scripts', 'product_image_ingest.py'), '')
}

class GitStub extends SubprocessRuntime {
  cloneCount = 0
  updateCount = 0
  readonly invocations: string[][] = []

  async resolveExecutable(): Promise<string> {
    return '/usr/bin/git'
  }

  spawn(spec: SubprocessSpawnSpec): SubprocessHandle {
    const cloning = spec.argv[1] === 'clone'
    this.invocations.push([...spec.argv])
    if (cloning) this.cloneCount += 1
    else this.updateCount += 1
    const target = spec.argv.at(-1)!
    const done = (cloning ? createCheckout(target) : Promise.resolve())
      .then(() => ({ exitCode: 0, signal: null }))
    const empty = { readFrom: () => ({ text: '', nextOffset: 0, lossy: false }) }
    return {
      pid: 1,
      stdin: undefined,
      stdout: undefined,
      stderr: undefined,
      collected: { stdout: empty, stderr: empty },
      done,
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

describe('explicit Git synchronization for WeChat skills', () => {
  it('clones exactly once, then updates the same checkout', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'wechat-skills-git-'))
    temporaryRoots.push(parent)
    process.env.DSH_HOME = join(parent, 'dsh-home')
    const sourceDir = resolveSkillSourceDir()
    const ctx = new Context()
    await ctx.plugin(SkillRegistry)
    await ctx.plugin(GitStub)
    const subprocess = ctx.subprocess as GitStub

    await ctx.plugin(skillsPlugin)

    expect(subprocess.cloneCount).toBe(0)
    expect(await ctx.skills.list()).toEqual([])
    await expect(ctx.wechatSkillSource.status()).resolves.toMatchObject({ state: 'missing', ready: false })

    await expect(ctx.wechatSkillSource.synchronize()).resolves.toMatchObject({
      state: 'ready',
      ready: true,
    })

    const catalog = await ctx.skills.list()
    expect(subprocess.cloneCount).toBe(1)
    expect(catalog.map(skill => skill.name)).toEqual([...WECHAT_SKILL_NAMES])
    const assets = await ctx.skills.get('aws-wechat-article-assets')
    expect(assets?.content).toContain('Body for aws-wechat-article-assets.')
    expect(assets?.source).toBe('custom')

    await expect(ctx.wechatSkillSource.synchronize()).resolves.toMatchObject({ state: 'ready' })
    expect(subprocess.cloneCount).toBe(1)
    expect(subprocess.updateCount).toBe(2)
    expect(subprocess.invocations.slice(-2).map(argv => argv.slice(3))).toEqual([
      ['fetch', '--depth', '1', 'origin', 'main'],
      ['reset', '--hard', 'FETCH_HEAD'],
    ])

    await ctx.fiber.dispose()
  })

  it('mounts a valid checkout at startup and only updates it on request', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'wechat-skills-existing-'))
    temporaryRoots.push(parent)
    process.env.DSH_HOME = join(parent, 'dsh-home')
    const sourceDir = resolveSkillSourceDir()
    await createCheckout(sourceDir)
    const ctx = new Context()
    await ctx.plugin(SkillRegistry)
    await ctx.plugin(GitStub)
    const subprocess = ctx.subprocess as GitStub

    await ctx.plugin(skillsPlugin)

    expect(subprocess.cloneCount).toBe(0)
    expect(subprocess.updateCount).toBe(0)
    await expect(ctx.wechatSkillSource.status()).resolves.toMatchObject({ state: 'ready', ready: true })
    expect(await ctx.skills.list()).toHaveLength(9)

    await expect(ctx.wechatSkillSource.synchronize()).resolves.toMatchObject({ state: 'ready', ready: true })
    expect(subprocess.cloneCount).toBe(0)
    expect(subprocess.updateCount).toBe(2)
    await ctx.fiber.dispose()
  })
})
