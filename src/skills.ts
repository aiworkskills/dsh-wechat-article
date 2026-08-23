/** Explicit Git installer and official filesystem provider for the WeChat skills. */
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import * as filesystemSkills from '@deepseek-ai/dsh-skill-filesystem'
import z from '@deepseek-ai/schemastery'
import { resolveSkillSourceDir } from './skill-source.ts'
import { WechatSkillSource } from './skill-source-service.ts'

const PROVIDER_NAME = 'aiworkskills-wechat-article-git'

export interface Config {
  readonly gitCommand?: string
  readonly skillSourceDir?: string
}

export const Config: z<Config> = z.object({
  gitCommand: z.string().default('git'),
  skillSourceDir: z.string().default(''),
})

export const name = 'aiworkskills-wechat-skills-git'
export const inject = ['skills', 'subprocess']

/** Register the installer immediately; mount the Skill provider only after an explicit install. */
export async function apply(ctx: Context, config: Config = {}): Promise<void> {
  const sourceDir = resolveSkillSourceDir(config.skillSourceDir)
  const source = new WechatSkillSource(ctx, config.gitCommand ?? 'git', async () => {
    await ctx.plugin(filesystemSkills, {
      providerName: PROVIDER_NAME,
      includeDefaultRoots: false,
      customSkillDirs: [join(sourceDir, 'skills')],
    })
  }, config.skillSourceDir)
  await source.mountIfInstalled()
}
