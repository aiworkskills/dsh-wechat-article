export const CONFIGURATION_ORIGIN = 'https://aiworkskills.cn'
export const CONFIGURATION_PROTOCOL = 1
export const CONFIGURATION_MESSAGE_SOURCE = 'aiworkskills-config'

export type ConfigurationEmbedMessage =
  | { readonly source: typeof CONFIGURATION_MESSAGE_SOURCE; readonly version: typeof CONFIGURATION_PROTOCOL; readonly type: 'ready' }
  | { readonly source: typeof CONFIGURATION_MESSAGE_SOURCE; readonly version: typeof CONFIGURATION_PROTOCOL; readonly type: 'apply'; readonly downloadUrl: string }
  /** Compatibility with the first deployed iframe protocol. */
  | { readonly source: typeof CONFIGURATION_MESSAGE_SOURCE; readonly version: typeof CONFIGURATION_PROTOCOL; readonly type: 'install'; readonly downloadUrl: string }

export function configurationEmbedUrl(parentOrigin: string): string {
  const url = new URL('/config', CONFIGURATION_ORIGIN)
  url.searchParams.set('embed', 'dsh')
  url.searchParams.set('protocol', String(CONFIGURATION_PROTOCOL))
  url.searchParams.set('parentOrigin', new URL(parentOrigin).origin)
  return url.href
}

export function parseConfigurationEmbedMessage(value: unknown): ConfigurationEmbedMessage | null {
  if (typeof value !== 'object' || value === null) return null
  const candidate = value as Record<string, unknown>
  if (candidate.source !== CONFIGURATION_MESSAGE_SOURCE || candidate.version !== CONFIGURATION_PROTOCOL) return null
  if (candidate.type === 'ready') {
    return { source: CONFIGURATION_MESSAGE_SOURCE, version: CONFIGURATION_PROTOCOL, type: 'ready' }
  }
  if ((candidate.type === 'apply' || candidate.type === 'install') && typeof candidate.downloadUrl === 'string') {
    return {
      source: CONFIGURATION_MESSAGE_SOURCE,
      version: CONFIGURATION_PROTOCOL,
      type: candidate.type,
      downloadUrl: candidate.downloadUrl,
    }
  }
  return null
}
