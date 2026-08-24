import { describe, expect, it } from 'vitest'
import {
  CONFIGURATION_MESSAGE_SOURCE,
  CONFIGURATION_PROTOCOL,
  configurationEmbedUrl,
  configurationOrigin,
  parseConfigurationEmbedMessage,
} from '../src/client/configuration-embed.js'

const site = { configurationUrl: 'https://aiworkskills.cn/config' }

describe('configuration iframe protocol', () => {
  it('builds a versioned iframe URL for the current DSH origin', () => {
    const url = new URL(configurationEmbedUrl('http://127.0.0.1:3081/session/123', site))
    expect(url.origin).toBe('https://aiworkskills.cn')
    expect(url.pathname).toBe('/config')
    expect(url.searchParams.get('embed')).toBe('dsh')
    expect(url.searchParams.get('protocol')).toBe(String(CONFIGURATION_PROTOCOL))
    expect(url.searchParams.get('parentOrigin')).toBe('http://127.0.0.1:3081')
  })

  it('points at the configuration site the deployment configured', () => {
    // The browser half used to hardcode one host, which made `configurationUrl`
    // a setting that changed nothing for anyone self-hosting the site.
    const url = new URL(configurationEmbedUrl('http://127.0.0.1:3081', {
      configurationUrl: 'https://config.acme.internal/wechat',
    }))
    expect(url.origin).toBe('https://config.acme.internal')
    expect(url.pathname).toBe('/wechat')
  })

  it('names the working set only when the Runtime is confined to one', () => {
    // Without it an embedded configuration site cannot tell itself apart from a
    // free-standing one, and would let the user switch accounts inside the
    // iframe — importing another account's settings, and its publishing
    // credentials, into this workspace.
    expect(new URL(configurationEmbedUrl('http://127.0.0.1:3081', site))
      .searchParams.get('workspace')).toBeNull()
    expect(new URL(configurationEmbedUrl('http://127.0.0.1:3081', { ...site, workspaceId: 'acct-7' }))
      .searchParams.get('workspace')).toBe('acct-7')
    // An empty id means "no second axis", not a working set named ''.
    expect(new URL(configurationEmbedUrl('http://127.0.0.1:3081', { ...site, workspaceId: '' }))
      .searchParams.get('workspace')).toBeNull()
  })

  it('trusts exactly the configured site as a message origin', () => {
    expect(configurationOrigin(site)).toBe('https://aiworkskills.cn')
    expect(configurationOrigin({ configurationUrl: 'https://config.acme.internal/wechat' }))
      .toBe('https://config.acme.internal')
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
