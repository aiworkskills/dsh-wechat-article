import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchConfigurationStatus } from '../src/client/configuration-status.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('configuration status client', () => {
  it('loads the secret-free status for the active session', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      state: 'ready',
      ready: true,
      issues: [],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchConfigurationStatus('session/one')).resolves.toEqual({ state: 'ready', ready: true, issues: [] })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('sessionId=session%2Fone'),
      expect.objectContaining({ cache: 'no-store', credentials: 'same-origin' }),
    )
  })

  it('rejects malformed status payloads', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"ready":true}', { status: 200 })))
    await expect(fetchConfigurationStatus('session')).rejects.toThrow('响应格式无效')
  })
})
