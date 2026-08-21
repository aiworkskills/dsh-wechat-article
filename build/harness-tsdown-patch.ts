/**
 * Out-of-tree fix for the Harness shared tsdown preset, 0.1.1-rc.2.
 *
 * `clientBundle` resolves a package's manifest with `workspaceManifest(id)`,
 * which only globs two-level package.json files under the Harness repository's
 * own `packages` tree, so building a plugin that lives outside that tree throws
 * "tsdown: no packages/.../package.json declares the name <id>". The manifest
 * is consulted lazily, from exactly three closures the preset places on its
 * returned configs: the node-half `deps` callbacks, the client-half `deps`
 * callbacks, and the `dsh-client-bundle-purity` resolveId gate. This module
 * calls the unmodified preset and swaps those closures for equivalents that
 * read THIS plugin's own package.json — the Harness sources are not touched.
 *
 * Delete this file and call `clientBundle` directly from tsdown.config.ts once
 * upstream lets the preset locate an out-of-tree manifest.
 */
import { readFileSync } from 'node:fs'
import { isBuiltin } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  clientBundle,
  INLINE_SAFE,
  requestedExternals,
} from '../../../deepseek-harness/packages/client/tsdown.client.ts'
import {
  PLATFORM_MODULES,
  PRELOADED_CLIENT_EXTERNALS,
} from '../../../deepseek-harness/packages/client/web/src/platform.ts'

/**
 * Config types derived from the preset itself: the Harness repository pins its
 * own tsdown, whose `UserConfig` differs from this repository's, so naming the
 * plugin-side type here would compare the two versions and fail typecheck.
 */
type PresetBuild = ReturnType<typeof clientBundle>
type PresetConfig = ReturnType<PresetBuild>[number]

/** The manifest fields the replaced closures read, mirroring the preset. */
interface PluginManifest {
  readonly name?: string
  readonly dependencies?: Record<string, string>
  readonly peerDependencies?: Record<string, string>
  readonly optionalDependencies?: Record<string, string>
  readonly dsh?: { readonly client?: { readonly external?: unknown } }
}

/**
 * Not exported by the preset, so restated here verbatim. If a build starts
 * inlining or rejecting the wrong @deepseek-ai specifiers, diff these against
 * `VENDORED_LIBRARY` / `GENERATED_REMOTE` in packages/client/tsdown.client.ts.
 */
const VENDORED_LIBRARY = /^@deepseek-ai\/(cosmokit|schemastery)(\/|$)/
const GENERATED_REMOTE = /^@deepseek-ai\/dsh-[a-z0-9]+(?:-[a-z0-9]+)*\/remote$/

/** The preset's purity-gate plugin name, asserted before replacement. */
const PURITY_PLUGIN = 'dsh-client-bundle-purity'

const PLUGIN_ROOT = fileURLToPath(new URL('..', import.meta.url))

/** Escape a package name for literal use inside a RegExp source. */
function escapeSpecifier(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Build one plugin package exactly as the Harness preset would, with the
 * manifest lookups grounded in this repository's package.json.
 * @param id - plugin package name; must match this repository's manifest.
 * @param libEntry - node-half entries, forwarded to the preset unchanged.
 * @returns the preset's ENV-selected config with the lookups replaced.
 */
export function outOfTreeClientBundle(
  id: string,
  libEntry: readonly string[],
): PresetBuild {
  const manifest = JSON.parse(
    readFileSync(resolve(PLUGIN_ROOT, 'package.json'), 'utf8'),
  ) as PluginManifest
  if (manifest.name !== id) {
    throw new Error(`harness-tsdown-patch: this repository's package.json declares ${String(manifest.name)}, not ${id}`)
  }

  const productionNames = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
  ])
  const productionPatterns = [...productionNames].sort()
    .map(name => new RegExp(`^${escapeSpecifier(name)}(/|$)`))
  const isProductionDependency = (specifier: string): boolean =>
    productionPatterns.some(pattern => pattern.test(specifier))

  const clientExternals = new Set<string>([
    ...PLATFORM_MODULES,
    ...PRELOADED_CLIENT_EXTERNALS,
    ...requestedExternals(id, manifest.dsh?.client ?? {}),
  ])
  const isRequested = (specifier: string): boolean => clientExternals.has(specifier)

  const preset = clientBundle(id, libEntry)
  return inlineConfig => preset(inlineConfig).map(config => patchConfig(config))

  /** Replace a returned config's manifest-backed closures, pass the rest through. */
  function patchConfig(config: PresetConfig): PresetConfig {
    if (config.name === id) {
      return {
        ...config,
        deps: {
          neverBundle: isProductionDependency,
          alwaysBundle: specifier => !isBuiltin(specifier) && !isProductionDependency(specifier),
        },
      }
    }
    if (config.name === `${id}/client`) {
      const plugins = config.plugins
      const first = (Array.isArray(plugins) ? plugins[0] : undefined) as { name?: string } | undefined
      if (!Array.isArray(plugins) || first?.name !== PURITY_PLUGIN) {
        throw new Error(`harness-tsdown-patch: the preset no longer leads with ${PURITY_PLUGIN} — review this patch against tsdown.client.ts`)
      }
      return {
        ...config,
        deps: {
          neverBundle: isRequested,
          alwaysBundle: specifier => !isRequested(specifier),
        },
        plugins: [{
          // Same rules and message as the preset's gate, over this manifest.
          name: PURITY_PLUGIN,
          resolveId(source: string) {
            if (!source.startsWith('@deepseek-ai/')) return null
            if (isRequested(source)) return null
            if (VENDORED_LIBRARY.test(source)) return null
            if (INLINE_SAFE.test(source) || GENERATED_REMOTE.test(source)) return null
            throw new Error(
              `client bundle purity: "${source}" is not in the default client externals or ${id}'s dsh.client.external, an inline-safe wire layer, or a generated /remote contribution — `
              + 'cross-plugin value imports are forbidden; declare a non-default module request or collaborate through cordis services '
              + '(type-only imports are erased and never reach this gate)',
            )
          },
        }, ...plugins.slice(1)],
      }
    }
    // The preset's face selection may return its skip sentinel ({ entry: '' });
    // anything else unrecognized means the preset shape changed underneath us.
    if (config.name === undefined && config.entry === '') return config
    throw new Error(`harness-tsdown-patch: unexpected preset config ${String(config.name)} — review this patch against tsdown.client.ts`)
  }
}
