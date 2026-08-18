/** Canonical configuration gate backed by the upstream Skill validator. */
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { Context, Service } from '@deepseek-ai/cordis'
import '@deepseek-ai/dsh-subprocess'
import z from '@deepseek-ai/schemastery'
import { parse } from 'yaml'
import type { ConfigurationStatus } from './configuration-contract.ts'
import { CONFIG_RELATIVE, ENV_RELATIVE, resolveWorkspace } from './domain/paths/workspace-paths.ts'
import { resolveSkillSourceDir, skillScript, validateSkillSource } from './skill-source.ts'

export type { ConfigurationState, ConfigurationStatus } from './configuration-contract.ts'

const CONFIG_PATH = CONFIG_RELATIVE
const ENV_PATH = ENV_RELATIVE
const MAX_CONFIG_BYTES = 2 * 1024 * 1024

const GLOBAL_FIELDS = [
  ['article_category', '账号领域'],
  ['target_reader', '目标读者'],
  ['default_author', '默认作者'],
] as const

/** Deployment configuration for the canonical Skill validator. */
export interface Config {
  readonly pythonCommand?: string
}

export const Config: z<Config> = z.object({
  pythonCommand: z.string().default('python3'),
})

function workspacePath(workspace: string): string {
  return resolveWorkspace(workspace)
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

function nonempty(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function outputIssues(stdout: string, stderr: string): string[] {
  const ignored = new Set(['failed', 'True', '配置校验通过'])
  const issues: string[] = []
  for (const raw of `${stdout}\n${stderr}`.split(/\r?\n/u)) {
    const line = raw.trim()
    if (line.length === 0 || ignored.has(line) || line.startsWith('（已跳过微信公众号校验')) continue
    issues.push(line.slice(0, 240))
    if (issues.length >= 12) break
  }
  return issues
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    wechatArticleConfiguration: WechatArticleConfiguration
  }
}

/** Validate one workspace without exposing any configuration or secret values. */
export class WechatArticleConfiguration extends Service {
  static inject = ['subprocess']
  static Config = Config

  private readonly pythonCommand: string
  private readonly validateScript: string

  constructor(ctx: Context, config: Config = {}) {
    super(ctx, 'wechatArticleConfiguration')
    this.pythonCommand = config.pythonCommand ?? 'python3'
    this.validateScript = skillScript(
      resolveSkillSourceDir(),
      'aws-wechat-article-main',
      'validate_env.py',
    )
    if (this.pythonCommand.trim().length === 0) throw new Error('pythonCommand must not be empty')
  }

  async check(workspace: string, signal?: AbortSignal): Promise<ConfigurationStatus> {
    const root = workspacePath(workspace)
    try {
      await validateSkillSource(resolveSkillSourceDir())
    } catch {
      return { state: 'missing', ready: false, issues: ['尚未安装公众号 Skill'] }
    }
    const configPath = join(root, CONFIG_PATH)
    const envPath = join(root, ENV_PATH)
    const missing: string[] = []
    if (!await isFile(configPath)) missing.push(CONFIG_PATH)
    if (!await isFile(envPath)) missing.push(ENV_PATH)
    if (missing.length > 0) return { state: 'missing', ready: false, issues: missing.map(path => `缺少 ${path}`) }

    const info = await stat(configPath)
    if (info.size > MAX_CONFIG_BYTES) {
      return { state: 'invalid', ready: false, issues: [`${CONFIG_PATH} 超过 2 MiB 限制`] }
    }

    let config: unknown
    try {
      config = parse(await readFile(configPath, 'utf8'))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { state: 'invalid', ready: false, issues: [`config.yaml 解析失败：${message.slice(0, 200)}`] }
    }
    if (typeof config !== 'object' || config === null || Array.isArray(config)) {
      return { state: 'invalid', ready: false, issues: ['config.yaml 须为 YAML 键值对象'] }
    }

    const record = config as Record<string, unknown>
    const issues = GLOBAL_FIELDS
      .filter(([key]) => !nonempty(record[key]))
      .map(([, label]) => `${label}未填写`)

    const executable = await this.ctx.subprocess.resolveExecutable(this.pythonCommand, undefined, signal)
    const handle = this.ctx.subprocess.spawn({
      argv: [executable, this.validateScript, '--config', configPath, '--env', envPath],
      cwd: root,
      stdio: {
        stdin: 'ignore',
        stdout: { maxBytes: 64 * 1024 },
        stderr: { maxBytes: 64 * 1024 },
      },
      graceMs: 3_000,
      ...(signal === undefined ? {} : { signal }),
    })
    const outcome = await handle.done
    const stdout = handle.collected.stdout?.readFrom(0).text ?? ''
    const stderr = handle.collected.stderr?.readFrom(0).text ?? ''
    if (outcome.exitCode !== 0) issues.push(...outputIssues(stdout, stderr))
    if (issues.length === 0 && outcome.exitCode !== 0) issues.push('配置校验未通过')
    if (issues.length > 0) return { state: 'invalid', ready: false, issues: [...new Set(issues)] }
    return { state: 'ready', ready: true, issues: [] }
  }

  async assertReady(workspace: string, signal?: AbortSignal): Promise<void> {
    const status = await this.check(workspace, signal)
    if (!status.ready) throw new Error(`公众号配置尚未就绪：${status.issues.join('；')}`)
  }
}

export default WechatArticleConfiguration
