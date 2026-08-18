import { watch, type FSWatcher } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { resolveDraftRoot } from './project-snapshot.ts'

interface WatchTarget {
  readonly path: string
  readonly recursive: boolean
}

async function directoryExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

async function watchTargets(workspace: string): Promise<WatchTarget[]> {
  const candidates: WatchTarget[] = [{ path: workspace, recursive: false }]
  const awsRoot = join(workspace, '.aws-article')
  const draftsRoot = await resolveDraftRoot(workspace)
  if (await directoryExists(awsRoot)) candidates.push({ path: awsRoot, recursive: true })
  if (await directoryExists(draftsRoot)) candidates.push({ path: draftsRoot, recursive: true })
  const targets = new Map<string, WatchTarget>()
  for (const candidate of candidates) {
    const existing = targets.get(candidate.path)
    if (existing === undefined || candidate.recursive) targets.set(candidate.path, candidate)
  }
  return [...targets.values()]
}

/** Watch the two Skill-owned project trees and rebuild watches when directories appear. */
export async function watchProjectWorkspace(workspaceInput: string, onChange: () => void): Promise<() => void> {
  const workspace = resolve(workspaceInput)
  let disposed = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let watchers: FSWatcher[] = []

  const rebuild = async (): Promise<void> => {
    if (disposed) return
    const next: FSWatcher[] = []
    try {
      for (const target of await watchTargets(workspace)) {
        const watcher = watch(target.path, { recursive: target.recursive }, schedule)
        watcher.on('error', schedule)
        next.push(watcher)
      }
    } catch {
      next.forEach(watcher => { watcher.close() })
      return
    }
    watchers.forEach(watcher => { watcher.close() })
    watchers = next
  }

  const schedule = (): void => {
    if (disposed) return
    if (timer !== undefined) return
    timer = setTimeout(() => {
      timer = undefined
      if (disposed) return
      onChange()
      void rebuild()
    }, 160)
  }

  await rebuild()
  return () => {
    disposed = true
    if (timer !== undefined) clearTimeout(timer)
    watchers.forEach(watcher => { watcher.close() })
    watchers = []
  }
}
