import { describe, expect, it, vi } from 'vitest'
import { createWorkbenchLabelStore, DEFAULT_WORKBENCH_LABEL } from '../src/client/workbench-label.js'

describe('workbench label store', () => {
  it('starts at the plugin’s own name', () => {
    expect(createWorkbenchLabelStore().snapshot()).toBe(DEFAULT_WORKBENCH_LABEL)
  })

  it('takes the deployment’s name and notifies once', () => {
    const store = createWorkbenchLabelStore()
    const listener = vi.fn()
    store.subscribe(listener)
    store.set('创作素材')
    expect(store.snapshot()).toBe('创作素材')
    // 同一个值再来一次不该让侧边栏重渲染。
    store.set('创作素材')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('ignores an empty name rather than blanking the entry', () => {
    // 这一项是称呼,不是能力:取不到名字的正确行为是照常显示,不是消失。
    const store = createWorkbenchLabelStore()
    store.set('   ')
    expect(store.snapshot()).toBe(DEFAULT_WORKBENCH_LABEL)
  })

  it('stops notifying after unsubscribe', () => {
    const store = createWorkbenchLabelStore()
    const listener = vi.fn()
    store.subscribe(listener)()
    store.set('创作素材')
    expect(listener).not.toHaveBeenCalled()
  })
})
