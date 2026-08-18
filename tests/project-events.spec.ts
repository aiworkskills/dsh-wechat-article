import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { watchProjectWorkspace } from '../src/project-events.js'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('project workspace events', () => {
  it('notifies when an article file changes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'wechat-project-events-'))
    roots.push(root)
    const article = join(root, 'drafts', '20260818-topic')
    await mkdir(article, { recursive: true })

    let resolveChange: (() => void) | undefined
    const changed = new Promise<void>(resolve => { resolveChange = resolve })
    const stop = await watchProjectWorkspace(root, () => { resolveChange?.() })
    const target = join(article, 'draft.md')
    const writer = setInterval(() => { void writeFile(target, `# 自动刷新 ${Date.now()}`) }, 150)
    try {
      await writeFile(target, '# 自动刷新')
      const outcome = await Promise.race([
        changed.then(() => 'changed' as const),
        new Promise<'timeout'>(resolve => { setTimeout(() => { resolve('timeout') }, 3_000) }),
      ])
      expect(outcome).toBe('changed')
    } finally {
      clearInterval(writer)
      stop()
    }
  })
})
