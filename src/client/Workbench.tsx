import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Button,
  IconCheckOutline16,
  IconCloseOutline16,
  IconDownloadOutline16,
  IconRefreshOutline16,
  IconSettingsOutline16,
  IconSkillOutline16,
  Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import { configurationImportPrompt } from './prompts.ts'
import {
  CONFIGURATION_ORIGIN,
  configurationEmbedUrl,
  parseConfigurationEmbedMessage,
} from './configuration-embed.ts'
import { ProjectWorkspace } from './ProjectWorkspace.tsx'
import { ConfigurationMenu, type ConfigurationMenuAction } from './features/workbench/ConfigurationMenu.tsx'
import { useWorkbenchState, type WorkbenchSection } from './features/workbench/useWorkbenchState.ts'
import css from './workbench.module.css'

interface WorkbenchFace {
  readonly onClose: () => void
  readonly openConfigurationFolder: (cwd: string) => Promise<void>
}
export type WorkbenchProps = PropsRuntime<'details'> & InjectFace<WorkbenchFace>

const SOURCE_URL = 'https://github.com/aiworkskills/wechat-article-skills'

const SECTION_LABELS: ReadonlyArray<{ readonly id: WorkbenchSection; readonly label: string }> = [
  { id: 'create', label: '创作' },
  { id: 'materials', label: '写作素材' },
]

function openExternal(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function Workbench({ sessionId, useInput, useSessions, inputActions, onClose, openConfigurationFolder }: WorkbenchProps) {
  const input = useInput(state => state)
  const sessionCwd = useSessions(state => state.byId[sessionId]?.cwd)
  const busy = input.phase !== 'plain'
  const {
    section,
    skillSource,
    configuration,
    skillMutation,
    skillMutationError,
    skillsInstalled,
    skillSourcePresent,
    configured,
    setSection,
    refreshSkillSource,
    synchronizeSkills,
  } = useWorkbenchState(sessionId, busy)

  const [configurationMessageError, setConfigurationMessageError] = useState('')
  const [configurationMenuOpen, setConfigurationMenuOpen] = useState(false)
  const configurationFrame = useRef<HTMLIFrameElement>(null)
  const workspaceScroll = useRef<HTMLDivElement>(null)
  const configurationUrl = useMemo(() => configurationEmbedUrl(window.location.origin), [])
  const websiteConfigurationUrl = useMemo(() => new URL('/config', CONFIGURATION_ORIGIN).href, [])

  useEffect(() => {
    workspaceScroll.current?.scrollTo({ top: 0, left: 0 })
  }, [section])

  const run = useCallback((prompt: string): boolean => {
    if (busy) return false
    if (input.draft.trim() !== '' && !window.confirm('输入框中已有未发送内容。继续将替换草稿并开始任务。')) return false
    inputActions.setDraft(prompt)
    inputActions.submit()
    return true
  }, [busy, input.draft, inputActions])

  const referenceArticleFile = useCallback((path: string): void => {
    const reference = `@${path}`
    const draft = input.draft.trim()
    inputActions.setDraft(draft === '' ? `${reference} ` : `${input.draft}${input.draft.endsWith(' ') ? '' : ' '}${reference} `)
  }, [input.draft, inputActions])

  useEffect(() => {
    const onMessage = (event: MessageEvent): void => {
      if (event.origin !== CONFIGURATION_ORIGIN) return
      if (event.source !== configurationFrame.current?.contentWindow) return
      const message = parseConfigurationEmbedMessage(event.data)
      if (message === null) return
      if (message.type === 'ready') return

      try {
        const prompt = configurationImportPrompt(message.downloadUrl)
        setConfigurationMessageError('')
        if (run(prompt)) onClose()
      } catch (error) {
        setConfigurationMessageError(error instanceof Error ? error.message : String(error))
      }
    }

    window.addEventListener('message', onMessage)
    return () => { window.removeEventListener('message', onMessage) }
  }, [onClose, run])

  const handleConfigurationSelect = useCallback((action: ConfigurationMenuAction) => {
    setConfigurationMenuOpen(false)
    setConfigurationMessageError('')
    if (action === 'embed') {
      setSection('config')
      return
    }
    if (action === 'website') {
      openExternal(websiteConfigurationUrl)
      return
    }
    if (sessionCwd === undefined) {
      setConfigurationMessageError('当前会话没有工作区目录')
      return
    }
    void openConfigurationFolder(sessionCwd).catch(error => {
      setConfigurationMessageError(error instanceof Error ? error.message : String(error))
    })
  }, [openConfigurationFolder, sessionCwd, setSection, websiteConfigurationUrl])

  const configurationMenuAnchor = (active: boolean, menuOpen: boolean, onMenuOpenChange: (open: boolean) => void) => (
    <button
      className={active ? css.configButtonActive : css.configButton}
      type="button"
      aria-label="公众号配置"
      aria-pressed={active}
      aria-haspopup="menu"
      aria-expanded={menuOpen}
      onMouseEnter={() => { onMenuOpenChange(true) }}
      onFocus={() => { onMenuOpenChange(true) }}
      onClick={() => { onMenuOpenChange(false); setSection('config') }}
    >
      <IconSettingsOutline16 size={12} />
      <span>技能配置</span>
    </button>
  )

  return (
    <div className={css.root}>
      <div className={css.toolbar}>
        <div className={css.toolbarTop}>
          <div className={css.titleGroup}>
            <IconSkillOutline16 />
            <strong>公众号</strong>
          </div>
          <div className={css.drawerActions}>
            {skillsInstalled && (
              <Tooltip label={skillMutation === 'updating' ? '正在从 GitHub 更新公众号写作 Skill' : '从 GitHub 更新公众号写作 Skill'} side="bottom">
                <button
                  className={css.updateSkillButton}
                  type="button"
                  aria-label="更新公众号写作 Skill"
                  disabled={skillMutation !== null}
                  onClick={() => { void synchronizeSkills('updating') }}
                >
                  <IconRefreshOutline16 size={12} />
                  <span>{skillMutation === 'updating' ? '更新中' : '更新 Skill'}</span>
                </button>
              </Tooltip>
            )}
            {configured && (
              <ConfigurationMenu
                open={configurationMenuOpen}
                onOpenChange={setConfigurationMenuOpen}
                onSelect={handleConfigurationSelect}
                anchor={configurationMenuAnchor(section === 'config', configurationMenuOpen, setConfigurationMenuOpen)}
              />
            )}
            <Tooltip label="关闭公众号工作台" side="bottom">
              <button className={css.iconButton} type="button" aria-label="关闭公众号工作台" onClick={onClose}>
                <IconCloseOutline16 size={12} className={css.toolbarGlyph} />
              </button>
            </Tooltip>
          </div>
        </div>
        {configured && (
          <div className={css.segmented} aria-label="工作台区域">
            {SECTION_LABELS.map(item => (
              <button
                className={item.id === section ? css.segmentActive : css.segment}
                type="button"
                aria-pressed={item.id === section}
                onClick={() => { setSection(item.id) }}
                key={item.id}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {skillsInstalled && skillMutationError !== '' && <div className={css.operationError} role="alert">{skillMutationError}</div>}
      {section === 'config' && configuration.phase === 'error' && <div className={css.operationError} role="alert">{configuration.message}</div>}
      {section === 'config' && configurationMessageError !== '' && <div className={css.operationError} role="alert">{configurationMessageError}</div>}

      <div className={css.scrollArea} ref={workspaceScroll}>
        {section === 'install' && (
          <main className={css.installView}>
            <span className={skillsInstalled ? css.installIconReady : css.installIcon}>
              {skillsInstalled ? <IconCheckOutline16 size={22} /> : <IconDownloadOutline16 size={22} />}
            </span>
            <div className={css.installCopy}>
              <h2>{skillsInstalled ? '公众号 Skill 已安装' : skillSourcePresent ? '更新公众号 Skill' : '安装公众号运营Skill'}</h2>
              <p><a className={css.installSourceLink} href={SOURCE_URL} target="_blank" rel="noopener noreferrer">aiworkskills/wechat-article-skills</a></p>
              <span>{skillsInstalled ? '官方 Skill 已就绪' : skillSourcePresent ? '从 GitHub 更新并修复现有目录' : '从 GitHub 安装官方开源仓库'}</span>
            </div>
            {skillSource.phase === 'error' && <div className={css.installError}>{skillSource.message}</div>}
            {skillSource.phase === 'loaded' && skillSource.status.issues.length > 0 && (
              <div className={css.installError}>{skillSource.status.issues.join('；')}</div>
            )}
            {skillMutationError !== '' && <div className={css.installError}>{skillMutationError}</div>}
            <div className={css.installActions}>
              {!skillsInstalled && (
                <Button
                  variant="primary"
                  icon={<IconDownloadOutline16 />}
                  disabled={skillSource.phase === 'loading' || skillMutation !== null}
                  onClick={() => { void synchronizeSkills(skillSourcePresent ? 'updating' : 'installing') }}
                >
                  {skillMutation === 'installing'
                    ? '正在安装'
                    : skillMutation === 'updating'
                      ? '正在更新'
                      : skillSource.phase === 'loading'
                        ? '正在检测'
                        : skillSourcePresent ? '更新公众号写作 Skill' : '安装公众号写作 Skill'}
                </Button>
              )}
              <Button variant="toolbar" disabled={skillMutation !== null} onClick={() => { void refreshSkillSource() }}>
                重新检测
              </Button>
            </div>
          </main>
        )}
        {section === 'checking' && (
          <main className={css.checkingView}>
            <span className={css.checkingIcon}><IconRefreshOutline16 /></span>
            <span>正在检查项目配置</span>
          </main>
        )}
        {section === 'config' && (
          <main className={css.configView}>
            <iframe
              className={css.configFrame}
              src={configurationUrl}
              title="公众号配置"
              sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups allow-popups-to-escape-sandbox"
              allow="clipboard-read; clipboard-write"
              referrerPolicy="strict-origin-when-cross-origin"
              ref={configurationFrame}
            />
          </main>
        )}
        {(section === 'create' || section === 'materials') && (
          <ProjectWorkspace view={section} sessionId={sessionId} onReferenceFile={referenceArticleFile} />
        )}
      </div>
    </div>
  )
}
