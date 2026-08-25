/** Client-safe configuration gate contract shared by Host and browser bundles. */
export const CONFIGURATION_STATUS_ROUTE = '/plugins/aiworkskills/wechat-article/configuration-status'

export type ConfigurationState = 'missing' | 'invalid' | 'ready'

/** Secret-free configuration state returned to the browser workbench. */
export interface ConfigurationStatus {
  readonly state: ConfigurationState
  readonly ready: boolean
  readonly issues: readonly string[]
}

/** Where the configuration site is, and what this Runtime may tell it. */
export const CONFIGURATION_EMBED_ROUTE = '/plugins/aiworkskills/wechat-article/configuration-embed'

/**
 * Facts about this deployment that the browser half cannot work out for itself.
 *
 * It is deliberately a separate route from the status above. Status answers "is
 * this workspace configured yet", changes as the user works and is refetched;
 * these are deployment constants that the workbench needs before any session
 * exists — the `message` handler has to know which origin to trust from the
 * first render.
 */
export interface ConfigurationEmbedInfo {
  /**
   * Absolute URL of the configuration site, as the deployment configured it.
   *
   * The browser half used to hardcode one, which quietly turned `configurationUrl`
   * into a setting that changed nothing: anyone self-hosting the configuration
   * site got their value honoured on the Host side and ignored in the iframe.
   */
  readonly configurationUrl: string

  /**
   * Which working set this Runtime serves, when the deployment gives each one
   * its own Runtime.
   *
   * Absent for the ordinary single-workspace install, and the configuration site
   * is expected to behave as it always has in that case. When present it is a
   * constraint: this workspace belongs to that working set, so a configuration
   * site that lets the user roam between accounts would be handing back settings
   * — and publishing credentials — belonging to a different one.
   *
   * The plugin only states the fact. What to do about it is the site's call.
   */
  readonly workspaceId?: string

  /**
   * What to call the workbench in the sidebar.
   *
   * Absent means the plugin's own name. A deployment that frames this workbench
   * inside a larger product may already carry the account identity elsewhere,
   * which leaves this entry naming a *thing* ("materials") rather than repeating
   * the account. The plugin has no opinion about which is right; it just stops
   * being the only one allowed to have one.
   */
  readonly workbenchLabel?: string
}
