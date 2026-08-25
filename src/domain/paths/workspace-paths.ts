/** Workspace-relative path helpers for `.aws-article` and the product library. */
import { realpath } from 'node:fs/promises'
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

/**
 * 把候选路径收敛在 root 之内，返回它的真实路径；越界、不存在或无法解析返回 null。
 *
 * 两边都先 realpath 再比较。只对字符串做前缀判断的话，root 内部一条指向外面的
 * 符号链接会被判为界内 —— 而工作区里的文件是模型写的，它完全可以自己造一条。
 * 收敛守的就是符号链接和绝对路径这两样；`..` 通常到不了这里（HTTP 路由的 URL
 * 解析会先把它规范化掉），但这个函数不指望调用者已经处理过。
 */
export async function confineToRoot(root: string, candidate: string): Promise<string | null> {
  if (candidate.includes('\0')) return null
  let realRoot: string
  let real: string
  try {
    realRoot = await realpath(root)
    real = await realpath(candidate)
  } catch {
    // root 不存在、目标不存在，或断掉的符号链接：都没有可服务的文件。
    return null
  }
  return real === realRoot || real.startsWith(`${realRoot}${sep}`) ? real : null
}

/** Resolve a workspace-relative product image path, rejecting escapes. */
export async function resolveProductImagePath(workspaceInput: string, path: string): Promise<string | null> {
  const workspace = resolveWorkspace(workspaceInput)
  return confineToRoot(productsRoot(workspace), resolve(workspace, path))
}

/** Resolve a workspace-relative product document path (product/*.md only). */
export async function resolveProductDocumentPath(workspaceInput: string, path: string): Promise<string | null> {
  const workspace = resolveWorkspace(workspaceInput)
  const root = productsRoot(workspace)
  const candidate = resolve(workspace, path)
  // 形状先判：产品文档只能是 products/<产品>/<文件>.md —— 恰好一层嵌套，且是
  // Markdown。这一条问的是"请求长什么样"，所以在原路径上判，不在 realpath 之后
  // 判 —— 真实路径可能落在完全不同的目录层级上（macOS 的 /var 就是个符号链接）。
  const nested = relative(root, candidate)
  if (nested.startsWith('..') || isAbsolute(nested)) return null
  if (nested.split(sep).length !== 2 || extname(candidate).toLowerCase() !== '.md') return null
  return confineToRoot(root, candidate)
}
