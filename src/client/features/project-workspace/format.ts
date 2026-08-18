export function filename(path: string): string {
  return path.split('/').at(-1) ?? path
}

export function articleTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  return `${date.getMonth() + 1}月${date.getDate()}日 ${time}`
}
