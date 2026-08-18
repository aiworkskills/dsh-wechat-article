import { basename } from 'node:path'

export function matches(query: string | undefined, ...values: string[]): boolean {
  const normalized = query?.trim().toLocaleLowerCase()
  return normalized === undefined || normalized.length === 0
    || values.some(value => value.toLocaleLowerCase().includes(normalized))
}

export function markdownTitle(filename: string, content: string): string {
  const heading = /^#\s+(.+)$/mu.exec(content)?.[1]?.trim()
  return heading && heading.length > 0 ? heading : basename(filename, '.md')
}

export function imageDescription(content: string): string {
  const match = /^\*\*图片描述\*\*[：:]\s*(.+)$/mu.exec(content)
  return match?.[1]?.trim() ?? content.trim()
}

export function libraryName(value: string, label: string, extension = ''): string {
  const normalized = value.trim().replace(/[\\/:*?"<>|\r\n\t]+/gu, '').replace(/^\.+|\.+$/gu, '').slice(0, 120)
  if (normalized === '') throw new Error(`${label}不能为空`)
  const base = extension !== '' && normalized.toLocaleLowerCase().endsWith(extension) ? normalized.slice(0, -extension.length) : normalized
  if (base === '') throw new Error(`${label}不能为空`)
  return `${base}${extension}`
}
