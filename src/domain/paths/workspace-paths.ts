/** Workspace-relative path helpers for `.aws-article` and the product library. */
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path'

export const PRODUCTS_RELATIVE = join('.aws-article', 'products')
export const CONFIG_RELATIVE = join('.aws-article', 'config.yaml')
export const ENV_RELATIVE = 'aws.env'

/** Resolve and validate an absolute workspace root. */
export function resolveWorkspace(workspace: string): string {
  if (!isAbsolute(workspace)) throw new Error(`workspace must be absolute: ${workspace}`)
  return resolve(workspace)
}

/** Convert an absolute path to a workspace-relative POSIX path. */
export function toRelativePath(workspace: string, path: string): string {
  return relative(resolveWorkspace(workspace), path).split(sep).join('/')
}

/** Absolute path to `.aws-article/products`. */
export function productsRoot(workspace: string): string {
  return join(resolveWorkspace(workspace), PRODUCTS_RELATIVE)
}

/** Resolve a workspace-relative product image path, rejecting escapes. */
export function resolveProductImagePath(workspaceInput: string, path: string): string | null {
  const workspace = resolveWorkspace(workspaceInput)
  const root = productsRoot(workspace)
  const candidate = resolve(workspace, path)
  return candidate.startsWith(`${root}${sep}`) ? candidate : null
}

/** Resolve a workspace-relative product document path (product/*.md only). */
export function resolveProductDocumentPath(workspaceInput: string, path: string): string | null {
  const workspace = resolveWorkspace(workspaceInput)
  const root = productsRoot(workspace)
  const candidate = resolve(workspace, path)
  const nested = relative(root, candidate)
  const parts = nested.split(sep)
  return !nested.startsWith('..') && !isAbsolute(nested) && parts.length === 2 && extname(candidate).toLowerCase() === '.md'
    ? candidate
    : null
}
