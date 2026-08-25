import { afterEach, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  productsRoot,
  resolveProductDocumentPath,
  resolveProductImagePath,
  resolveWorkspace,
  toRelativePath,
} from '../src/domain/paths/workspace-paths.js'

const roots: string[] = []

afterEach(async () => {
  while (roots.length > 0) await rm(roots.pop()!, { recursive: true, force: true })
})

/** A workspace with one product, one document, one image. */
async function workspaceWithLibrary(): Promise<string> {
  const workspace = await mkdtemp(join(tmpdir(), 'wechat-paths-'))
  roots.push(workspace)
  const product = join(workspace, '.aws-article', 'products', 'DSH')
  await mkdir(join(product, 'images'), { recursive: true })
  await writeFile(join(product, '介绍.md'), '# 介绍\n')
  await writeFile(join(product, 'images', '界面.png'), '')
  return workspace
}

describe('workspace paths', () => {
  it('requires absolute workspace roots', () => {
    expect(() => resolveWorkspace('relative/path')).toThrow(/absolute/)
  })

  it('converts absolute paths to workspace-relative POSIX paths', () => {
    const workspace = join(tmpdir(), 'wechat-workspace')
    const absolute = join(workspace, '.aws-article', 'products', 'DSH', '介绍.md')
    expect(toRelativePath(workspace, absolute)).toBe('.aws-article/products/DSH/介绍.md')
    expect(productsRoot(workspace)).toBe(join(workspace, '.aws-article', 'products'))
  })

  it('resolves product library paths and rejects escapes', async () => {
    const workspace = await workspaceWithLibrary()
    const inside = '.aws-article/products/DSH/images/界面.png'
    expect(await resolveProductImagePath(workspace, inside)).toContain('界面.png')
    expect(await resolveProductImagePath(workspace, '../../../etc/passwd')).toBeNull()
    // 收敛只服务存在的文件：不存在与越界给同一个答案，否则调用方可以拿它探路。
    expect(await resolveProductImagePath(workspace, '.aws-article/products/DSH/images/无.png')).toBeNull()
  })

  it('refuses a symlink that points out of the product library', async () => {
    // 这才是收敛在 realpath 之后比较的理由。工作区里的文件是模型写的，它完全可以
    // 自己造一条指向外面的链接 —— 只做字符串前缀判断的话，这条链接是"界内"的。
    const workspace = await workspaceWithLibrary()
    const outside = await mkdtemp(join(tmpdir(), 'wechat-outside-'))
    roots.push(outside)
    await writeFile(join(outside, 'secret.png'), '')
    const link = join(workspace, '.aws-article', 'products', 'DSH', 'images', 'escape.png')
    await symlink(join(outside, 'secret.png'), link)
    expect(await resolveProductImagePath(workspace, '.aws-article/products/DSH/images/escape.png')).toBeNull()
  })

  it('accepts only product-root markdown documents', async () => {
    const workspace = await workspaceWithLibrary()
    const nested = join(workspace, '.aws-article', 'products', 'DSH', 'nested')
    await mkdir(nested, { recursive: true })
    await writeFile(join(nested, '介绍.md'), '# 深一层\n')
    expect(await resolveProductDocumentPath(workspace, '.aws-article/products/DSH/介绍.md')).toContain('介绍.md')
    expect(await resolveProductDocumentPath(workspace, '.aws-article/products/DSH/images/界面.png')).toBeNull()
    expect(await resolveProductDocumentPath(workspace, '.aws-article/products/DSH/nested/介绍.md')).toBeNull()
  })
})
