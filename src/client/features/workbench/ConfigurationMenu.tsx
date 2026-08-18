import { useEffect, useRef, type ReactNode } from 'react'
import {
  IconFolderOpenOutline16,
  IconLinkOutline14,
  IconSettingsOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import css from '../../workbench.module.css'

export type ConfigurationMenuAction = 'embed' | 'website' | 'manual'

const ITEMS: ReadonlyArray<{ readonly id: ConfigurationMenuAction; readonly label: string; readonly icon: ReactNode }> = [
  { id: 'embed', label: '在线配置', icon: <IconSettingsOutline16 size={12} className={css.configurationMenuIcon} /> },
  { id: 'website', label: '去网站配置', icon: <IconLinkOutline14 size={12} className={css.configurationMenuIcon} /> },
  { id: 'manual', label: '手动配置', icon: <IconFolderOpenOutline16 size={12} className={css.configurationMenuIcon} /> },
]

export function ConfigurationMenu({
  open,
  anchor,
  onOpenChange,
  onSelect,
}: {
  readonly open: boolean
  readonly anchor: ReactNode
  readonly onOpenChange: (open: boolean) => void
  readonly onSelect: (action: ConfigurationMenuAction) => void
}) {
  const rootRef = useRef<HTMLSpanElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelClose = (): void => {
    if (closeTimer.current !== null) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }

  const scheduleClose = (): void => {
    cancelClose()
    closeTimer.current = setTimeout(() => { onOpenChange(false) }, 120)
  }

  useEffect(() => () => { cancelClose() }, [])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent): void => {
      if (!(event.target instanceof Node)) return
      if (rootRef.current?.contains(event.target) === true) return
      onOpenChange(false)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onOpenChange, open])

  return (
    <span
      ref={rootRef}
      className={css.configurationMenu}
      onMouseEnter={() => { cancelClose(); onOpenChange(true) }}
      onFocus={() => { onOpenChange(true) }}
      onMouseLeave={() => { if (open) scheduleClose() }}
    >
      {anchor}
      {open && (
        <div className={css.configurationMenuList} role="menu">
          {ITEMS.map(item => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className={css.configurationMenuItem}
              onClick={() => { onSelect(item.id) }}
            >
              <span className={css.configurationMenuIconSlot}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </span>
  )
}
