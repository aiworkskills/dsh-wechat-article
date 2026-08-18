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

  it('accepts only deployed aiworkskills .aws configuration links', () => {
    expect(configurationImportPrompt('请导入：https://aiworkskills.cn/download/account.aws'))
      .toContain('原始 validate_env.py 校验当前项目')
    expect(() => configurationImportPrompt('https://example.com/account.aws')).toThrow('只接受')
    expect(() => configurationImportPrompt('https://aiworkskills.cn/config')).toThrow('只接受')
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
