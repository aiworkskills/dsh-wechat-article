import { describe, expect, it, vi } from 'vitest'
import { createWorkbenchPanelController } from '../src/client/panel-controller.js'

describe('workbench panel controller', () => {
  it('temporarily mounts the details takeover and restores it on close', () => {
    const unmount = vi.fn()
    const mount = vi.fn(() => unmount)
    const openDetails = vi.fn()
    const closeDetails = vi.fn()
    const listener = vi.fn()
    const panel = createWorkbenchPanelController({ mount, openDetails, closeDetails })
    panel.subscribe(listener)

    panel.open()
    panel.open()

    expect(mount).toHaveBeenCalledTimes(1)
    expect(openDetails).toHaveBeenCalledTimes(2)
    expect(panel.getSnapshot()).toBe(true)

    panel.close()

    expect(closeDetails).toHaveBeenCalledTimes(1)
    expect(unmount).toHaveBeenCalledTimes(1)
    expect(panel.getSnapshot()).toBe(false)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('disposes a mounted takeover without driving layout during plugin teardown', () => {
    const unmount = vi.fn()
    const closeDetails = vi.fn()
    const panel = createWorkbenchPanelController({
      mount: () => unmount,
      openDetails: () => {},
      closeDetails,
    })

    panel.open()
    panel.dispose()

    expect(unmount).toHaveBeenCalledTimes(1)
    expect(closeDetails).not.toHaveBeenCalled()
    expect(panel.getSnapshot()).toBe(false)
  })
})
