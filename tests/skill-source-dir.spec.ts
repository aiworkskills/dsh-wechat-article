import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { resolveSkillSourceDir } from '../src/skill-source.js'

describe('Skill 检出位置', () => {
  it('默认放在 DSH_HOME 下，由插件按需 clone', () => {
    expect(resolveSkillSourceDir())
      .toBe(join(resolveDshHome(), 'sources', 'aiworkskills', 'wechat-article-skills'))
  })

  it('可指向预置检出，供托管部署共用一份固定版本', () => {
    expect(resolveSkillSourceDir('/opt/wechat-article-skills')).toBe('/opt/wechat-article-skills')
  })

  it('空值与空白视为未配置，回到默认位置', () => {
    // Schemastery 的默认值是空字符串，所以"未配置"到达这里时不是 undefined。
    // 若把空串当成路径，检出会落到进程当前目录下。
    const fallback = resolveSkillSourceDir()
    expect(resolveSkillSourceDir('')).toBe(fallback)
    expect(resolveSkillSourceDir('   ')).toBe(fallback)
  })
})
