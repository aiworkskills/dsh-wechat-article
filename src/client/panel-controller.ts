/** Observable controller for temporarily taking over the native details column. */
export interface WorkbenchPanelController {
  readonly getSnapshot: () => boolean
  readonly subscribe: (listener: () => void) => () => void
  readonly open: () => void
  readonly close: () => void
  readonly toggle: () => void
  readonly dispose: () => void
}

/** Create one process-local controller around the details registration lifecycle. */
export function createWorkbenchPanelController(options: {
  readonly mount: () => () => void
  readonly openDetails: () => void
  readonly closeDetails: () => void
}): WorkbenchPanelController {
  let open = false
  let unmount: (() => void) | undefined
  const listeners = new Set<() => void>()

  const publish = (next: boolean): void => {
    if (open === next) return
    open = next
    for (const listener of listeners) listener()
  }

  const close = (): void => {
    if (!open && unmount === undefined) return
    options.closeDetails()
    const dispose = unmount
    unmount = undefined
    dispose?.()
    publish(false)
  }

  const controller: WorkbenchPanelController = {
    getSnapshot: () => open,
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    open() {
      if (unmount === undefined) unmount = options.mount()
      options.openDetails()
      publish(true)
    },
    close,
    toggle() {
      if (open) close()
      else controller.open()
    },
    dispose() {
      const dispose = unmount
      unmount = undefined
      dispose?.()
      publish(false)
      listeners.clear()
    },
  }
  return controller
}
