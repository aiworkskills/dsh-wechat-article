import { mkdir, mkdtemp, rename, rm, stat } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import { Context, Service } from '@deepseek-ai/cordis'
import '@deepseek-ai/dsh-subprocess'
import type { SkillSourceStatus } from './skill-source-contract.ts'
import {
  SKILL_REPOSITORY,
  SKILL_REPOSITORY_REF,
  resolveSkillSourceDir,
  validateSkillSource,
} from './skill-source.ts'

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    wechatSkillSource: WechatSkillSource
  }
}

/** Own the explicit Git installation lifecycle for the upstream Skill repository. */
export class WechatSkillSource extends Service {
  private synchronization: Promise<void> | undefined
  private operation: 'installing' | 'updating' | undefined
  private providerMounted = false

  constructor(
    ctx: Context,
    private readonly gitCommand: string,
    private readonly mountProvider: () => Promise<void>,
  ) {
    super(ctx, 'wechatSkillSource')
  }

  async status(): Promise<SkillSourceStatus> {
    if (this.operation !== undefined) return this.result(this.operation, [])
    const sourceDir = resolveSkillSourceDir()
    if (!await exists(sourceDir)) return this.result('missing', [])
    try {
      await validateSkillSource(sourceDir)
      return this.result('ready', [])
    } catch (error) {
      return this.result('invalid', [error instanceof Error ? error.message : String(error)])
    }
  }

  async synchronize(): Promise<SkillSourceStatus> {
    const current = await this.status()
    if (this.synchronization === undefined) {
      this.operation = current.state === 'missing' ? 'installing' : 'updating'
      this.synchronization = (current.state === 'missing' ? this.clone() : this.update())
        .then(async () => { await this.ensureProvider() })
      void this.synchronization.finally(() => {
        this.synchronization = undefined
        this.operation = undefined
      }).catch(() => {})
    }
    await this.synchronization
    return this.status()
  }

  async mountIfInstalled(): Promise<void> {
    if ((await this.status()).ready) await this.ensureProvider()
  }

  private result(state: SkillSourceStatus['state'], issues: readonly string[]): SkillSourceStatus {
    return {
      state,
      ready: state === 'ready',
      repository: SKILL_REPOSITORY,
      ref: SKILL_REPOSITORY_REF,
      issues,
    }
  }

  private async ensureProvider(): Promise<void> {
    if (this.providerMounted) return
    await this.mountProvider()
    this.providerMounted = true
  }

  private async clone(): Promise<void> {
    const sourceDir = resolveSkillSourceDir()
    const parent = dirname(sourceDir)
    await mkdir(parent, { recursive: true })
    const staging = await mkdtemp(`${parent}/.${basename(sourceDir)}-`)
    try {
      const executable = await this.ctx.subprocess.resolveExecutable(this.gitCommand)
      const handle = this.ctx.subprocess.spawn({
        argv: [
          executable,
          'clone',
          '--depth',
          '1',
          '--single-branch',
          '--branch',
          SKILL_REPOSITORY_REF,
          SKILL_REPOSITORY,
          staging,
        ],
        cwd: parent,
        stdio: {
          stdin: 'ignore',
          stdout: { maxBytes: 64 * 1024 },
          stderr: { maxBytes: 64 * 1024 },
        },
        graceMs: 5_000,
      })
      const outcome = await handle.done
      if (outcome.exitCode !== 0) {
        const stderr = handle.collected.stderr?.readFrom(0).text.trim()
        throw new Error(stderr || `git clone exited with ${String(outcome.exitCode)}`)
      }
      await validateSkillSource(staging)
      try {
        await rename(staging, sourceDir)
      } catch (error) {
        if (!await exists(sourceDir)) throw error
        await validateSkillSource(sourceDir)
      }
    } finally {
      await rm(staging, { recursive: true, force: true })
    }
  }

  private async update(): Promise<void> {
    const sourceDir = resolveSkillSourceDir()
    const executable = await this.ctx.subprocess.resolveExecutable(this.gitCommand)
    await this.runGit(executable, sourceDir, [
      'fetch',
      '--depth',
      '1',
      'origin',
      SKILL_REPOSITORY_REF,
    ])
    // This checkout is managed exclusively by the plugin. Resetting tracked files
    // handles an upstream force-push without attempting to merge stale revisions.
    await this.runGit(executable, sourceDir, ['reset', '--hard', 'FETCH_HEAD'])
    await validateSkillSource(sourceDir)
  }

  private async runGit(executable: string, cwd: string, args: readonly string[]): Promise<void> {
    const handle = this.ctx.subprocess.spawn({
      argv: [executable, '-C', cwd, ...args],
      cwd,
      stdio: {
        stdin: 'ignore',
        stdout: { maxBytes: 64 * 1024 },
        stderr: { maxBytes: 64 * 1024 },
      },
      graceMs: 5_000,
    })
    const outcome = await handle.done
    if (outcome.exitCode !== 0) {
      const stderr = handle.collected.stderr?.readFrom(0).text.trim()
      throw new Error(stderr || `git ${args[0]} exited with ${String(outcome.exitCode)}`)
    }
  }
}
