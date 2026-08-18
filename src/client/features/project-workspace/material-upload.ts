import type { MaterialUpload } from './useProjectWorkspaceState.ts'

interface LegacyFileEntry { readonly isFile: boolean; readonly isDirectory: boolean; readonly name: string; readonly fullPath: string }
interface LegacyFileFileEntry extends LegacyFileEntry { file: (success: (file: File) => void, failure: (error: unknown) => void) => void }
interface LegacyFileDirectoryEntry extends LegacyFileEntry { createReader: () => { readEntries: (success: (entries: LegacyFileEntry[]) => void, failure: (error: unknown) => void) => void } }

export function uploadsFromFiles(files: FileList | readonly File[]): MaterialUpload[] {
  return Array.from(files).map(file => ({ file, relativePath: file.webkitRelativePath || file.name }))
}

async function filesFromEntry(entry: LegacyFileEntry): Promise<MaterialUpload[]> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => { (entry as LegacyFileFileEntry).file(resolve, reject) })
    return [{ file, relativePath: entry.fullPath || file.name }]
  }
  if (!entry.isDirectory) return []
  const reader = (entry as LegacyFileDirectoryEntry).createReader()
  const children: LegacyFileEntry[] = []
  for (;;) {
    const batch = await new Promise<LegacyFileEntry[]>((resolve, reject) => { reader.readEntries(resolve, reject) })
    if (batch.length === 0) break
    children.push(...batch)
  }
  return (await Promise.all(children.map(filesFromEntry))).flat()
}

export async function uploadsFromDrop(transfer: DataTransfer): Promise<MaterialUpload[]> {
  const entries = Array.from(transfer.items).map(item => item.webkitGetAsEntry() as unknown as LegacyFileEntry | null).filter((entry): entry is LegacyFileEntry => entry != null)
  return entries.length > 0 ? (await Promise.all(entries.map(filesFromEntry))).flat() : uploadsFromFiles(transfer.files)
}
