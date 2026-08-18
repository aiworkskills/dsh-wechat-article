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

export function resolveSkillSourceDir(): string {
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
