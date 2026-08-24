import { describe, expect, it } from 'vitest'
import {
  WORKFLOWS,
  configurationImportPrompt,
  ingestImagePrompt,
  searchImagesPrompt,
  searchProductPrompt,
  workflowPrompt,
} from '../src/client/prompts.js'

describe('wechat workbench prompts', () => {
  it('exposes every focused Skill workflow', () => {
    expect(WORKFLOWS.map(item => item.skill)).toEqual([
      'aws-wechat-article-main',
      'aws-wechat-article-topics',
      'aws-wechat-article-writing',
      'aws-wechat-article-review',
      'aws-wechat-article-formatting',
      'aws-wechat-article-images',
      'aws-wechat-article-publish',
    ])
  })

  it('accepts only .aws links from the configured site', () => {
    const site = 'https://aiworkskills.cn/config'
    expect(configurationImportPrompt('请导入：https://aiworkskills.cn/download/account.aws', site))
      .toContain('原始 validate_env.py 校验当前项目')
    // Subdomains of the configured host count; unrelated hosts do not.
    expect(configurationImportPrompt('https://cdn.aiworkskills.cn/a.aws', site)).toContain('请导入这份')
    expect(() => configurationImportPrompt('https://example.com/account.aws', site)).toThrow('只接受')
    expect(() => configurationImportPrompt('https://aiworkskills.cn/config', site)).toThrow('只接受')
  })

  it('follows the deployment to a self-hosted configuration site', () => {
    // The allowlist used to be a constant, so a self-hosted site could never
    // import anything: the refusal named a domain its operator never configured.
    const site = 'https://config.acme.internal/wechat'
    expect(configurationImportPrompt('https://config.acme.internal/d/a.aws', site))
      .toContain('请导入这份')
    expect(() => configurationImportPrompt('https://aiworkskills.cn/d/a.aws', site))
      .toThrow('config.acme.internal')
  })

  it('keeps product and image rules explicit in submitted tasks', () => {
    expect(workflowPrompt(WORKFLOWS[0]!, '发布插件介绍', '公众号AI运营助手'))
      .toContain('按 Skill 规则读取该产品的知识库和图片库')
    expect(searchProductPrompt('公众号AI运营助手', '配置'))
      .toContain('事实与来源文件')
    expect(searchImagesPrompt('公众号AI运营助手', '配置页面'))
      .toContain('不作为封面')
    expect(ingestImagePrompt('公众号AI运营助手', '/tmp/config.png', '配置页面'))
      .toContain('Skill 自带的产品图片入库脚本')
  })
})
