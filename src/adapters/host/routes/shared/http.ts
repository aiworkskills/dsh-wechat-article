import type { IncomingMessage, ServerResponse } from 'node:http'
import { extname } from 'node:path'
import { UserInputError } from '../../../../domain/errors.ts'

export function sendJson(res: ServerResponse, status: number, value: unknown): void {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
}

export function requireSameOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin
  const host = req.headers.host
  return origin === undefined || (host !== undefined && new URL(origin).host === host)
}

export async function readJson(req: IncomingMessage, maxBytes: number): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let length = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    length += buffer.length
    if (length > maxBytes) throw new UserInputError('请求内容过大')
    chunks.push(buffer)
  }
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new UserInputError('请求格式无效')
  return value as Record<string, unknown>
}

export function textField(body: Record<string, unknown>, name: string): string {
  const value = body[name]
  if (typeof value !== 'string') throw new UserInputError(`${name}无效`)
  return value
}

export function imageContentType(path: string): string | undefined {
  switch (extname(path).toLowerCase()) {
    case '.png': return 'image/png'
    case '.jpg':
    case '.jpeg': return 'image/jpeg'
    case '.webp': return 'image/webp'
    case '.gif': return 'image/gif'
  }
}

export function imagePayload(dataUrl: string): { readonly extension: string; readonly data: Buffer } {
  const match = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$/u.exec(dataUrl)
  if (match === null) throw new UserInputError('仅支持 PNG、JPEG、WebP 或 GIF 图片')
  const format = match[1]
  const encoded = match[2]
  if (format === undefined || encoded === undefined) throw new UserInputError('图片格式无效')
  const extension = format === 'jpeg' ? '.jpg' : `.${format}`
  const data = Buffer.from(encoded, 'base64')
  if (data.length === 0 || data.length > 10 * 1024 * 1024) throw new UserInputError('图片大小必须在 10 MB 以内')
  return { extension, data }
}
