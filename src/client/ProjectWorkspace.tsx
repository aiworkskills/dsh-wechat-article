import { Button, IconRefreshOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import { ArticleBrowser } from './features/project-workspace/ArticleBrowser.tsx'
import { MaterialsBrowser } from './features/project-workspace/MaterialsBrowser.tsx'
import { useProjectWorkspaceState } from './features/project-workspace/useProjectWorkspaceState.ts'
import css from './workbench.module.css'

export type WorkbenchView = 'create' | 'materials'

interface Props {
  readonly view: WorkbenchView
  readonly sessionId: string
  readonly onReferenceFile: (path: string) => void
}

export function ProjectWorkspace({ view, sessionId, onReferenceFile }: Props) {
  const {
    load,
    snapshot,
    mutationBusy,
    mutationError,
    refresh,
    createCategory,
    renameCategory,
    renameDocument,
    renameImage,
    deleteDocument,
    deleteImage,
    uploadMaterialFiles,
  } = useProjectWorkspaceState(sessionId, view)

  if (load.phase === 'loading') {
    return <main className={css.checkingView}><span className={css.checkingIcon}><IconRefreshOutline16 /></span><span>正在读取公众号项目</span></main>
  }
  if (load.phase === 'error') {
    return <main className={css.content}><div className={css.operationError}>{load.message}</div><Button variant="toolbar" onClick={() => { void refresh() }}>重新读取</Button></main>
  }
  if (view === 'create') {
    return <ArticleBrowser snapshot={snapshot!} sessionId={sessionId} onReferenceFile={onReferenceFile} refresh={() => { void refresh() }} />
  }
  return <MaterialsBrowser snapshot={snapshot!} sessionId={sessionId} busy={mutationBusy} error={mutationError} onCreateCategory={createCategory} onRenameCategory={renameCategory} onRenameDocument={renameDocument} onRenameImage={renameImage} onDeleteDocument={deleteDocument} onDeleteImage={deleteImage} onUploadFiles={uploadMaterialFiles} />
}
