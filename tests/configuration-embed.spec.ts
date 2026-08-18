import { describe, expect, it } from 'vitest'
import {
  CONFIGURATION_MESSAGE_SOURCE,
  CONFIGURATION_PROTOCOL,
  configurationEmbedUrl,
  parseConfigurationEmbedMessage,
} from '../src/client/configuration-embed.js'

describe('configuration iframe protocol', () => {
  it('builds a versioned iframe URL for the current DSH origin', () => {
    const url = new URL(configurationEmbedUrl('http://127.0.0.1:3081/session/123'))
    expect(url.origin).toBe('https://aiworkskills.cn')
    expect(url.pathname).toBe('/config')
    expect(url.searchParams.get('embed')).toBe('dsh')
    expect(url.searchParams.get('protocol')).toBe(String(CONFIGURATION_PROTOCOL))
    expect(url.searchParams.get('parentOrigin')).toBe('http://127.0.0.1:3081')
  })

  it('accepts ready, apply, and legacy install messages from the agreed schema', () => {
    expect(parseConfigurationEmbedMessage({
      source: CONFIGURATION_MESSAGE_SOURCE,
      version: CONFIGURATION_PROTOCOL,
      type: 'ready',
    })?.type).toBe('ready')
    expect(parseConfigurationEmbedMessage({
      source: CONFIGURATION_MESSAGE_SOURCE,
      version: CONFIGURATION_PROTOCOL,
      type: 'apply',
      downloadUrl: 'https://aiworkskills.cn/download/account.aws',
    })).toMatchObject({ type: 'apply', downloadUrl: 'https://aiworkskills.cn/download/account.aws' })
    expect(parseConfigurationEmbedMessage({
      source: CONFIGURATION_MESSAGE_SOURCE,
      version: CONFIGURATION_PROTOCOL,
      type: 'install',
      downloadUrl: 'https://aiworkskills.cn/download/account.aws',
    })).toMatchObject({ type: 'install', downloadUrl: 'https://aiworkskills.cn/download/account.aws' })
  })

  it('rejects unknown versions and malformed apply messages', () => {
    expect(parseConfigurationEmbedMessage({
      source: CONFIGURATION_MESSAGE_SOURCE,
      version: 2,
      type: 'ready',
    })).toBeNull()
    expect(parseConfigurationEmbedMessage({
      source: CONFIGURATION_MESSAGE_SOURCE,
      version: CONFIGURATION_PROTOCOL,
      type: 'apply',
    })).toBeNull()
  })
})
