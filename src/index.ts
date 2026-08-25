/**
 * Unified Cordis entry point for the WeChat article workspace.
 *
 * 这是 Host 平面唯一的组合根：解析部署输入，装配三个服务，再挂上路由、工具、
 * 命令与 Skill 提供者。所有部署事实都从 `Config` 进来，插件不去读环境变量 ——
 * 那样才能既在单机安装下有一套能用的默认值，又让托管部署完整地说了算。
 */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { apply as registerCommands } from './host/commands.ts'
import { WechatArticleConfiguration } from './host/configuration.ts'
import { WechatProductLibrary } from './host/library.ts'
import { WechatThumbnails } from './host/thumbnails.ts'
import { apply as registerRoutes } from './host/routes/index.ts'
import { apply as registerSkills } from './host/skills.ts'
import { apply as registerTools } from './host/tools.ts'

export interface Config {
  readonly gitCommand?: string
  readonly pythonCommand?: string
  readonly maxDocumentBytes?: number
  readonly maxResults?: number
  readonly configurationUrl?: string
  /** 预置的 Skill 检出目录；留空则用 DSH_HOME 下的默认位置并按需 clone。 */
  readonly skillSourceDir?: string
  /**
   * 本 Runtime 服务于哪一个工作集（例如某一个公众号）。
   *
   * 留空是普通的单工作区安装，配置站照常自由切换。有值时它是一条约束：本工作区
   * 属于那个工作集，于是内嵌的配置站不应再让用户漫游到别的账号 —— 那会把另一个
   * 账号的设置和发布凭据带进这个工作区。
   *
   * 每个工作集一个 Runtime 的部署，在 profile 里把自己的标识注进来即可；插件不需要
   * 知道那个标识来自哪个网关、叫什么环境变量。
   */
  readonly workspaceId?: string
  /**
   * 左边栏里这个工作台叫什么。留空即插件自己的名字。
   *
   * 把工作台嵌进更大的产品里时，账号身份往往已经由外面那一层承载了，这一项于是
   * 该命名一件**事**（"创作素材"）而不是把账号再念一遍。插件对哪种叫法更对没有
   * 意见 —— 它只是不再是唯一有权发表意见的那个。
   */
  readonly workbenchLabel?: string
  /** 缩略图内存缓存上限（字节）。留 0 用默认的 8 MiB。 */
  readonly thumbnailCacheBytes?: number
}

export const Config: z<Config> = z.object({
  gitCommand: z.string().default('git'),
  pythonCommand: z.string().default('python3'),
  maxDocumentBytes: z.number().default(1_048_576),
  maxResults: z.number().default(50),
  configurationUrl: z.string().default('https://aiworkskills.cn/config'),
  skillSourceDir: z.string().default(''),
  workspaceId: z.string().default(''),
  workbenchLabel: z.string().default(''),
  thumbnailCacheBytes: z.number().default(0),
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
  const skillSourceDir = config.skillSourceDir ?? ''
  const workspaceId = config.workspaceId?.trim() ?? ''
  const workbenchLabel = config.workbenchLabel?.trim() ?? ''
  const thumbnailCacheBytes = config.thumbnailCacheBytes ?? 0
  new WechatProductLibrary(ctx, {
    pythonCommand,
    maxDocumentBytes,
    maxResults,
    skillSourceDir,
  })
  new WechatArticleConfiguration(ctx, { pythonCommand, skillSourceDir })
  new WechatThumbnails(ctx, { pythonCommand, ...(thumbnailCacheBytes === 0 ? {} : { thumbnailCacheBytes }) })
  await registerSkills(ctx, { gitCommand, skillSourceDir })
  registerRoutes(ctx, {
    configurationUrl,
    ...(workspaceId === '' ? {} : { workspaceId }),
    ...(workbenchLabel === '' ? {} : { workbenchLabel }),
  })
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
} from './host/library.ts'

export { WechatArticleConfiguration } from './host/configuration.ts'

export type { ConfigurationState, ConfigurationStatus } from './contracts/configuration.ts'
