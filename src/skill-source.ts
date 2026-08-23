import { access, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'

export const SKILL_REPOSITORY = 'https://github.com/aiworkskills/wechat-article-skills.git'
export const SKILL_REPOSITORY_REF = 'main'

export const WECHAT_SKILL_NAMES = [
  'aws-wechat-article-assets',
  'aws-wechat-article-formatting',
  'aws-wechat-article-images',
  'aws-wechat-article-main',
  'aws-wechat-article-publish',
  'aws-wechat-article-review',
  'aws-wechat-article-topics',
  'aws-wechat-article-writing',
  'aws-wechat-sticker',
] as const

/**
 * 公众号 Skill 检出所在目录。
 *
 * 默认落在 DSH_HOME 下，每个 DSH_HOME 各自持有一份，由插件按需 git clone。
 * 单机单用户时这样最省事。
 *
 * 托管部署不适用这个默认值：那里每个用户都有独立的 DSH_HOME，于是每来一个新用户
 * 就要重新 clone 一次 GitHub —— 既要求运行环境能访问外网，也让不同用户可能拿到
 * 不同版本的 Skill。这类部署应当预置一份共享检出并用 `override` 指向它，Skill
 * 版本随镜像固定，启动不依赖网络。内网隔离、企业代理后，以及需要锁定 Skill 版本
 * 的场景同理。
 */
export function resolveSkillSourceDir(override?: string): string {
  const configured = override?.trim()
  if (configured !== undefined && configured.length > 0) return configured
  return join(resolveDshHome(), 'sources', 'aiworkskills', 'wechat-article-skills')
}

export function skillScript(sourceDir: string, skill: string, script: string): string {
  return join(sourceDir, 'skills', skill, 'scripts', script)
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

export async function validateSkillSource(sourceDir: string): Promise<void> {
  if (!await isDirectory(join(sourceDir, '.git'))) {
    throw new Error(`Skill source is not a Git checkout: ${sourceDir}`)
  }
  for (const name of WECHAT_SKILL_NAMES) {
    try {
      await access(join(sourceDir, 'skills', name, 'SKILL.md'))
    } catch {
      throw new Error(`Git checkout is missing skills/${name}/SKILL.md: ${sourceDir}`)
    }
  }
  for (const path of [
    skillScript(sourceDir, 'aws-wechat-article-main', 'validate_env.py'),
    skillScript(sourceDir, 'aws-wechat-article-assets', 'product_image_ingest.py'),
  ]) {
    try {
      await access(path)
    } catch {
      throw new Error(`Git checkout is missing required script: ${path}`)
    }
  }
}
