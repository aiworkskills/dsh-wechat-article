/** Human commands for discovering the bundle and opening its deployed configuration site. */
import type { Context } from '@deepseek-ai/cordis'
import '@deepseek-ai/dsh-commands'
import z from '@deepseek-ai/schemastery'

const DEFAULT_CONFIGURATION_URL = 'https://aiworkskills.cn/config'

/** Command plugin configuration. */
export interface Config {
  readonly configurationUrl?: string
}

/** Validated command plugin configuration. */
export const Config: z<Config> = z.object({
  configurationUrl: z.string().default(DEFAULT_CONFIGURATION_URL),
})

/** Cordis plugin name. */
export const name = 'aiworkskills-wechat-commands'
/** Services required by the command consumer. */
export const inject = ['commands']

/** Register bundle discovery and external configuration commands. */
export function apply(ctx: Context, config: Config = {}): void {
  const configurationUrl = config.configurationUrl ?? DEFAULT_CONFIGURATION_URL
  let parsed: URL
  try {
    parsed = new URL(configurationUrl)
  } catch {
    throw new Error(`configurationUrl must be an absolute URL: ${configurationUrl}`)
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`configurationUrl must use HTTP(S): ${configurationUrl}`)
  }

  ctx.commands.register({
    name: 'wechat',
    description: 'Show the installed WeChat article workflow and product-library capabilities.',
    handler: () => ({
      kind: 'success',
      text: [
        '公众号文章插件已启用：9 个原版 Skill、产品知识库检索、产品图片库检索与图片入库。',
        `配置工具：${configurationUrl}`,
        '直接描述选题、写作、审核、排版、配图或发布任务即可；涉及自有产品时会按 Skill 规则读取项目内 .aws-article/products。',
      ].join('\n'),
    }),
  })

  ctx.commands.register({
    name: 'wechat-config',
    description: 'Open the deployed aiworkskills configuration tool.',
    handler: () => ({ kind: 'success', text: configurationUrl }),
  })
}
