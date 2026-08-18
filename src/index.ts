/** Unified Cordis entry point for the WeChat article workspace. */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { apply as registerCommands } from './commands.ts'
import { WechatArticleConfiguration } from './configuration.ts'
import { apply as registerRoutes } from './configuration-route.ts'
import { WechatProductLibrary } from './library.ts'
import { apply as registerSkills } from './skills.ts'
import { apply as registerTools } from './tools.ts'

export interface Config {
  readonly gitCommand?: string
  readonly pythonCommand?: string
  readonly maxDocumentBytes?: number
  readonly maxResults?: number
  readonly configurationUrl?: string
}

export const Config: z<Config> = z.object({
  gitCommand: z.string().default('git'),
  pythonCommand: z.string().default('python3'),
  maxDocumentBytes: z.number().default(1_048_576),
  maxResults: z.number().default(50),
  configurationUrl: z.string().default('https://aiworkskills.cn/config'),
})

export const name = 'aws-wechat-article'
export const inject = ['agents', 'commands', 'skills', 'subprocess', 'tools', 'webServer']

/** Register all internal capabilities under one user-visible plugin node. */
export async function apply(ctx: Context, config: Config = {}): Promise<void> {
  const gitCommand = config.gitCommand ?? 'git'
  const pythonCommand = config.pythonCommand ?? 'python3'
  const maxDocumentBytes = config.maxDocumentBytes ?? 1_048_576
  const maxResults = config.maxResults ?? 50
  const configurationUrl = config.configurationUrl ?? 'https://aiworkskills.cn/config'
  new WechatProductLibrary(ctx, {
    pythonCommand,
    maxDocumentBytes,
    maxResults,
  })
  new WechatArticleConfiguration(ctx, { pythonCommand })
  await registerSkills(ctx, { gitCommand })
  registerRoutes(ctx)
  registerTools(ctx)
  registerCommands(ctx, { configurationUrl })
}

export {
  WechatProductLibrary,
  type ImageIngestRequest,
  type ImageIngestResult,
  type ProductDocument,
  type ProductImage,
  type ProductSummary,
} from './library.ts'

export { WechatArticleConfiguration } from './configuration.ts'

export type { ConfigurationState, ConfigurationStatus } from './configuration-contract.ts'
