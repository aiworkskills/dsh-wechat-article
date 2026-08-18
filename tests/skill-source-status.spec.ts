import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchSkillSourceStatus, synchronizeSkillSource } from '../src/client/skill-source-status.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

const ready = {
  state: 'ready',
  ready: true,
  repository: 'https://github.com/aiworkskills/wechat-article-skills.git',
  ref: 'main',
  issues: [],
}

describe('Skill source client', () => {
  it('reads installation status without mutating the Host', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(ready), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchSkillSourceStatus()).resolves.toEqual(ready)
    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ method: 'GET' }))
  })

  it('uses an explicit POST to install or update', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(ready), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(synchronizeSkillSource()).resolves.toEqual(ready)
    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      method: 'POST',
      credentials: 'same-origin',
    }))
  })

  it('surfaces the Host installation error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      error: 'skill-sync-failed',
      message: 'git pull failed',
    }), { status: 500 })))

    await expect(synchronizeSkillSource()).rejects.toThrow('git pull failed')
  })
})
