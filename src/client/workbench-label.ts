/**
 * 左边栏那一行叫什么。
 *
 * 名字是部署事实，而客户端插件拿不到 profile 配置 —— 所以它和配置站地址、工作集
 * 标识走同一条路：Host 侧的 embed 路由。这里是个外部存储而不是组件里的 state，
 * 因为读它的是侧边栏那颗常驻按钮，而取值发生在插件装配时、组件挂载之前。
 *
 * 取不到就用插件自己的名字。这一项是称呼，不是能力：拿不到名字的正确行为是照常
 * 显示，不是消失。
 */
import { fetchConfigurationEmbedInfo } from './configuration-embed.ts'

export const DEFAULT_WORKBENCH_LABEL = '公众号'

export interface WorkbenchLabelStore {
  subscribe(listener: () => void): () => void
  snapshot(): string
  set(label: string): void
}

export function createWorkbenchLabelStore(initial = DEFAULT_WORKBENCH_LABEL): WorkbenchLabelStore {
  let current = initial
  const listeners = new Set<() => void>()
  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    snapshot: () => current,
    set(label) {
      const next = label.trim()
      if (next === '' || next === current) return
      current = next
      for (const listener of [...listeners]) listener()
    },
  }
}

/** Fill the store from the Host once; failures leave the default in place. */
export function loadWorkbenchLabel(store: WorkbenchLabelStore, signal: AbortSignal): void {
  void fetchConfigurationEmbedInfo(signal)
    .then(info => { if (info.workbenchLabel !== undefined) store.set(info.workbenchLabel) })
    .catch(() => undefined)
}
