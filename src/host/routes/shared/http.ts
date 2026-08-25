import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Stats } from 'node:fs'
import { extname } from 'node:path'
import { UserInputError } from '../../../domain/errors.ts'

export interface RouteErrorBody {
  readonly error: string
  readonly message?: string
}

/**
 * Map a thrown error to an HTTP status and JSON body for route handlers.
 *
 * 只有 `UserInputError` 是 400。其余一律 500 —— 写文件 EACCES、磁盘满、YAML 解析
 * 崩，都是服务端的问题，报成 400 等于告诉用户「是你填错了」，于是他会去改一个
 * 本来没错的输入。
 */
export function mapRouteError(error: unknown, fallbackCode: string): { readonly status: number; readonly body: RouteErrorBody } {
  const message = error instanceof Error ? error.message : String(error)
  return { status: error instanceof UserInputError ? 400 : 500, body: { error: fallbackCode, message } }
}

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

/**
 * 校验器:文件的身份,而不是它的内容。
 *
 * 用 size+mtime 而不是内容哈希 —— 后者要把整张图读一遍才能决定"不用发",
 * 而这些文件动辄几百 KB。弱校验器(W/)正是为这种"够用就好"的判断准备的。
 */
export function fileValidators(info: Stats): { readonly etag: string; readonly lastModified: string } {
  const seconds = Math.floor(info.mtimeMs / 1000)
  return {
    etag: `W/"${info.size.toString(16)}-${seconds.toString(16)}"`,
    lastModified: new Date(seconds * 1000).toUTCString(),
  }
}

/**
 * 这个请求是否可以用 304 打发。
 *
 * If-None-Match 优先于 If-Modified-Since —— HTTP 规范如此,而且 mtime 只有秒级
 * 精度,同一秒内的两次改写它分辨不出来,ETag 带上了大小则能。
 */
export function isFresh(req: IncomingMessage, validators: { readonly etag: string; readonly lastModified: string }): boolean {
  const noneMatch = req.headers['if-none-match']
  if (noneMatch !== undefined) {
    return noneMatch.split(',').some(candidate => candidate.trim() === validators.etag)
  }
  const since = req.headers['if-modified-since']
  if (since === undefined) return false
  const asked = Date.parse(since)
  return !Number.isNaN(asked) && Date.parse(validators.lastModified) <= asked
}

/**
 * 图片响应的缓存头。
 *
 * `maxAge` 是"多久之内**连问都不问**"。文章配图给 0:智能体正在改它们,过期的
 * 封面比多一次条件请求难受得多 —— 而带上校验器之后,那次请求的代价是一个 304,
 * 几百字节。素材库改动少,给 5 分钟。
 */
export function imageCacheHeaders(
  info: Stats,
  maxAge: number,
): Record<string, string> {
  const validators = fileValidators(info)
  return {
    'Cache-Control': maxAge === 0 ? 'private, max-age=0, must-revalidate' : `private, max-age=${String(maxAge)}`,
    'ETag': validators.etag,
    'Last-Modified': validators.lastModified,
  }
}

/**
 * 请求要的是缩略图吗。
 *
 * 只认一个开关而不是任意宽度：宽度由调用方自由指定的话，缓存键就是无界的，
 * 而每一次未命中都要拉起一次图像解码 —— 那是个放大器。
 */
export function wantsThumbnail(url: string, route: string): boolean {
  return new URL(url || route, 'http://localhost').searchParams.get('thumb') === '1'
}
