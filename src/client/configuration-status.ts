import { CONFIGURATION_STATUS_ROUTE, type ConfigurationStatus } from '../configuration-contract.ts'

function isStatus(value: unknown): value is ConfigurationStatus {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<ConfigurationStatus>
  return (candidate.state === 'missing' || candidate.state === 'invalid' || candidate.state === 'ready')
    && typeof candidate.ready === 'boolean'
    && Array.isArray(candidate.issues)
    && candidate.issues.every(issue => typeof issue === 'string')
}

/** Read the active session's Host-validated, secret-free configuration state. */
export async function fetchConfigurationStatus(sessionId: string, signal?: AbortSignal): Promise<ConfigurationStatus> {
  const query = new URLSearchParams({ sessionId })
  const response = await fetch(`${CONFIGURATION_STATUS_ROUTE}?${query.toString()}`, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'same-origin',
    ...(signal === undefined ? {} : { signal }),
  })
  if (!response.ok) throw new Error(`配置状态请求失败（${response.status}）`)
  const value: unknown = await response.json()
  if (!isStatus(value)) throw new Error('配置状态响应格式无效')
  return value
}
