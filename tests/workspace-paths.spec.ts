import { describe, expect, it } from 'vitest'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  productsRoot,
  resolveProductDocumentPath,
  resolveProductImagePath,
  resolveWorkspace,
  toRelativePath,
} from '../src/domain/paths/workspace-paths.js'

describe('workspace paths', () => {
  const workspace = join(tmpdir(), 'wechat-workspace')

  it('requires absolute workspace roots', () => {
    expect(() => resolveWorkspace('relative/path')).toThrow(/absolute/)
  })

  it('resolves product library paths and rejects escapes', () => {
    const inside = '.aws-article/products/DSH/images/界面.png'
    const outside = '../../../etc/passwd'
    expect(resolveProductImagePath(workspace, inside)).toBe(join(workspace, inside))
    expect(resolveProductImagePath(workspace, outside)).toBeNull()
  })

  it('accepts only product-root markdown documents', () => {
    expect(resolveProductDocumentPath(workspace, '.aws-article/products/DSH/介绍.md')).toContain('介绍.md')
    expect(resolveProductDocumentPath(workspace, '.aws-article/products/DSH/images/界面.png')).toBeNull()
    expect(resolveProductDocumentPath(workspace, '.aws-article/products/DSH/nested/介绍.md')).toBeNull()
  })

  it('converts absolute paths to workspace-relative POSIX paths', () => {
    const absolute = join(workspace, '.aws-article', 'products', 'DSH', '介绍.md')
    expect(toRelativePath(workspace, absolute)).toBe('.aws-article/products/DSH/介绍.md')
    expect(productsRoot(workspace)).toBe(join(workspace, '.aws-article', 'products'))
  })
})
