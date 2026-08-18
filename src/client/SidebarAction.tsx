import { useEffect, useRef, useSyncExternalStore } from 'react'
import { IconSkillOutline16, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { WorkbenchPanelController } from './panel-controller.ts'
import css from './workbench.module.css'

interface SidebarActionFace {
  readonly panel: WorkbenchPanelController
}

export type SidebarActionProps = PropsRuntime<'sidebar.footer.action'> & InjectFace<SidebarActionFace>

/** Add the persistent WeChat entry above Settings in the native sidebar. */
export function SidebarAction({ wide, useSessions, panel }: SidebarActionProps) {
  const open = useSyncExternalStore(panel.subscribe, panel.getSnapshot, panel.getSnapshot)
  const current = useSessions(state => state.current)
  const available = useSessions(state => current !== undefined && state.byId[current]?.blank === false)
  const previousSession = useRef(current)

  useEffect(() => {
    if (open && (!available || previousSession.current !== current)) panel.close()
    previousSession.current = current
  }, [available, current, open, panel])

  return (
    <div className={wide ? css.sidebarActionRoot : `${css.sidebarActionRoot} ${css.sidebarActionRail}`}>
      <Tooltip label="公众号工作台" side="right" disabled={wide}>
        <button
          className={css.sidebarAction}
          type="button"
          aria-label="公众号工作台"
          aria-expanded={open}
          aria-pressed={open}
          disabled={!available}
          onClick={panel.toggle}
        >
          <IconSkillOutline16 size={wide ? 16 : 18} />
          {wide && <span>公众号</span>}
        </button>
      </Tooltip>
    </div>
  )
}
