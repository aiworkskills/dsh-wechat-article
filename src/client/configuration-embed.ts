import { CONFIGURATION_EMBED_ROUTE, type ConfigurationEmbedInfo } from '../contracts/configuration.ts'

export const CONFIGURATION_PROTOCOL = 1
export const CONFIGURATION_MESSAGE_SOURCE = 'aiworkskills-config'

export type ConfigurationEmbedMessage =
  | { readonly source: typeof CONFIGURATION_MESSAGE_SOURCE; readonly version: typeof CONFIGURATION_PROTOCOL; readonly type: 'ready' }
  | { readonly source: typeof CONFIGURATION_MESSAGE_SOURCE; readonly version: typeof CONFIGURATION_PROTOCOL; readonly type: 'apply'; readonly downloadUrl: string }
  /** Compatibility with the first deployed iframe protocol. */
  | { readonly source: typeof CONFIGURATION_MESSAGE_SOURCE; readonly version: typeof CONFIGURATION_PROTOCOL; readonly type: 'install'; readonly downloadUrl: string }

function isInfo(value: unknown): value is ConfigurationEmbedInfo {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<ConfigurationEmbedInfo>
  if (typeof candidate.configurationUrl !== 'string' || candidate.configurationUrl === '') return false
  return candidate.workspaceId === undefined || typeof candidate.workspaceId === 'string'
}

/**
 * Read the deployment facts the browser half cannot work out for itself.
 *
 * These used to be a constant in this file, which quietly made `configurationUrl`
 * a setting that changed nothing: a self-hosted configuration site was honoured
 * on the Host side and ignored in the iframe, and the mismatch showed up only as
 * a page that never left "copy the install prompt".
 */
export async function fetchConfigurationEmbedInfo(signal?: AbortSignal): Promise<ConfigurationEmbedInfo> {
  const response = await fetch(CONFIGURATION_EMBED_ROUTE, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'same-origin',
    ...(signal === undefined ? {} : { signal }),
  })
  if (!response.ok) throw new Error(`配置站信息请求失败（${response.status}）`)
  const value: unknown = await response.json()
  if (!isInfo(value)) throw new Error('配置站信息响应格式无效')
  return value
}

/** The origin the configuration iframe posts from, and therefore the only one to trust. */
export function configurationOrigin(info: ConfigurationEmbedInfo): string {
  return new URL(info.configurationUrl).origin
}

/**
 * Where to point the configuration iframe.
 *
 * `workspace` is appended only when the deployment gives each working set its
 * own Runtime. To the configuration site it reads as a constraint: this
 * workspace belongs to that working set. A site that let the user roam to
 * another one while embedded would hand back settings — and publishing
 * credentials — belonging to a working set this Runtime has no business holding.
 *
 * A single-workspace install sends no such parameter and the site should behave
 * exactly as before: switching there is how you choose what you are configuring,
 * and taking it away would break the ordinary local install.
 */
export function configurationEmbedUrl(parentOrigin: string, info: ConfigurationEmbedInfo): string {
  const url = new URL(info.configurationUrl)
  url.searchParams.set('embed', 'dsh')
  url.searchParams.set('protocol', String(CONFIGURATION_PROTOCOL))
  url.searchParams.set('parentOrigin', new URL(parentOrigin).origin)
  if (info.workspaceId !== undefined && info.workspaceId !== '') {
    url.searchParams.set('workspace', info.workspaceId)
  }
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
