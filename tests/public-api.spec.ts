import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as root from '../src/index.js'
import * as contracts from '../src/contracts.js'

describe('public package API', () => {
  it('exposes the unified root entry surface', () => {
    expect(typeof root.apply).toBe('function')
    expect(root.name).toBe('aws-wechat-article')
    expect(root.WechatProductLibrary).toBeTypeOf('function')
    expect(root.WechatArticleConfiguration).toBeTypeOf('function')
    expect('CONFIGURATION_STATUS_ROUTE' in root).toBe(false)
    expect('ProductLibraryConfig' in root).toBe(false)
  })

  it('exposes shared contracts from the contracts subpath', () => {
    expect(contracts.CONFIGURATION_STATUS_ROUTE).toBe('/plugins/aiworkskills/wechat-article/configuration-status')
    expect(contracts.PROJECT_SNAPSHOT_ROUTE).toBe('/plugins/aiworkskills/wechat-article/project-snapshot')
    expect(contracts.SKILL_SOURCE_ROUTE).toBe('/plugins/aiworkskills/wechat-article/skill-source')
    expect(contracts.WORKBENCH_DETAILS_PRIORITY).toBe(-10)
  })

  it('publishes exactly three code entry points', () => {
    // 每个子路径都是一条永久承诺。曾经有十条，其中八条从来没有第二个消费者 ——
    // 内部模块一旦挂上 exports，改名就成了破坏性变更。
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      readonly exports: Record<string, unknown>
    }
    expect(Object.keys(manifest.exports)).toEqual([
      '.', './contracts', './client', './cordis.patch.yml', './package.json',
    ])
  })
})
