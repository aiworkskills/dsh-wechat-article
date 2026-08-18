import { describe, expect, it } from 'vitest'
import * as root from '../src/index.js'
import * as contracts from '../src/contracts.js'
import * as library from '../src/library.js'
import * as configurationRoute from '../src/configuration-route.js'

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
  })

  it('keeps Cordis plugin surfaces on their dedicated entries', () => {
    expect(library.WechatProductLibrary).toBeTypeOf('function')
    expect(typeof configurationRoute.apply).toBe('function')
    expect(configurationRoute.name).toBe('aiworkskills-wechat-configuration-route')
    expect(configurationRoute.PROJECT_EVENTS_ROUTE).toBe('/plugins/aiworkskills/wechat-article/project-events')
  })
})
