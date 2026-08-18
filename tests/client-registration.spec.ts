import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { describe, expect, it } from 'vitest'
import { apply } from '../src/client/index.js'

describe('wechat client registration', () => {
  it('adds a native sidebar entry without eagerly taking over details', () => {
    const injected: string[] = []
    const registered: string[] = []
    const ctx = {
      effect(factory: () => unknown) {
        return factory()
      },
      layout: {
        openDetails() {},
        closeDetails() {},
      },
      slots: {
        inject(name: string, factory: () => unknown) {
          injected.push(name)
          return factory()
        },
        register(options: { name: string }) {
          registered.push(options.name)
          return () => {}
        },
      },
    } as unknown as ClientContext

    apply(ctx)

    expect(injected).toEqual(['sidebar.footer.action'])
    expect(registered).toEqual(['sidebar.footer.action'])
  })
})
