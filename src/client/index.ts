import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ClientSessionContext, InputTriggerServiceContract, InputTriggerSource } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { SidebarAction } from './SidebarAction.tsx'
import { Workbench } from './Workbench.tsx'
import { createWorkbenchPanelController } from './panel-controller.ts'
import { fetchProjectSnapshot } from './project-snapshot.ts'

export const inject = ['slots', 'layout', 'inputTriggers', 'workspaces']

function configurationDirectory(cwd: string): string {
  return `${cwd.replace(/[/\\]+$/u, '')}/.aws-article`
}

function articleReferenceSource(): InputTriggerSource {
  const files = new Map<string, readonly string[]>()
  const subscribers = new Map<string, Set<() => void>>()
  const refresh = async (session: ClientSessionContext): Promise<readonly string[]> => {
    const snapshot = await fetchProjectSnapshot(session.sessionId)
    const paths = snapshot.articles.flatMap(article => article.files.map(file => file.path))
    files.set(session.sessionId, paths)
    subscribers.get(session.sessionId)?.forEach(listener => { listener() })
    return paths
  }
  return {
    trigger: '@',
    name: 'wechat-article-files',
    order: 10,
    async candidates(session, { query }) {
      const paths = await refresh(session)
      const normalized = query.toLocaleLowerCase()
      return paths.filter(path => path.toLocaleLowerCase().includes(normalized)).map(name => ({ name, description: '公众号文章文件' }))
    },
    warm(session) { void refresh(session).catch(() => undefined) },
    lexicon(session) { return files.get(session.sessionId) },
    subscribeLexicon(session, listener) {
      const listeners = subscribers.get(session.sessionId) ?? new Set<() => void>()
      listeners.add(listener)
      subscribers.set(session.sessionId, listeners)
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) subscribers.delete(session.sessionId)
      }
    },
    onPick({ candidate }) { return { text: `@${candidate.name} ` } },
  }
}

export function apply(ctx: ClientContext): void {
  const inputTriggers = ctx.inputTriggers as InputTriggerServiceContract | undefined
  if (inputTriggers !== undefined) ctx.effect(() => inputTriggers.registerSource(articleReferenceSource()), 'wechat-article: @ article files')
  let panel = createWorkbenchPanelController({
    mount: () => ctx.slots.inject('details', () => ctx.slots.register({
      name: 'details',
      priority: -10,
      inject: () => ({
        onClose: panel.close,
        openConfigurationFolder: async (cwd: string) => {
          await ctx.workspaces.openPath(configurationDirectory(cwd))
        },
      }),
    }, Workbench)),
    openDetails: () => { ctx.layout.openDetails() },
    closeDetails: () => { ctx.layout.closeDetails() },
  })

  ctx.effect(() => () => { panel.dispose() }, 'wechat-article: details takeover')
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'wechat-article-workbench',
    order: 20,
    inject: () => ({ panel }),
  }, SidebarAction))
}
