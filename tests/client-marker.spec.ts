import { describe, expect, it } from 'vitest'
import { Config, apply, inject, name } from '../src/index.js'

describe('unified host plugin', () => {
  it('exposes one named Cordis entry point', () => {
    expect(name).toBe('aws-wechat-article')
    expect(typeof apply).toBe('function')
    expect(inject).toEqual(['agents', 'commands', 'skills', 'subprocess', 'tools', 'webServer'])
    expect(Config).toBeDefined()
  })
})
