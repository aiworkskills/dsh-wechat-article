/** Client-safe configuration gate contract shared by Host and browser bundles. */
export const CONFIGURATION_STATUS_ROUTE = '/plugins/aiworkskills/wechat-article/configuration-status'

export type ConfigurationState = 'missing' | 'invalid' | 'ready'

/** Secret-free configuration state returned to the browser workbench. */
export interface ConfigurationStatus {
  readonly state: ConfigurationState
  readonly ready: boolean
  readonly issues: readonly string[]
}
