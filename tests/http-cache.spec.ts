import type { IncomingMessage } from 'node:http'
import type { Stats } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { fileValidators, imageCacheHeaders, isFresh } from '../src/host/routes/shared/http.js'

const info = (size: number, mtimeMs: number): Stats => ({ size, mtimeMs } as Stats)
const req = (headers: Record<string, string>): IncomingMessage => ({ headers } as unknown as IncomingMessage)

describe('image cache validators', () => {
  it('derives a weak validator from size and mtime, not content', () => {
    // 内容哈希要把整张图读一遍才能决定"不用发",而这些文件动辄几百 KB。
    const { etag, lastModified } = fileValidators(info(509_000, 1_787_000_000_500))
    expect(etag).toMatch(/^W\/"[0-9a-f]+-[0-9a-f]+"$/)
    expect(lastModified).toBe(new Date(1_787_000_000_000).toUTCString())
  })

  it('changes when the file changes, either way', () => {
    const base = fileValidators(info(100, 1_787_000_000_000)).etag
    expect(fileValidators(info(101, 1_787_000_000_000)).etag).not.toBe(base)
    expect(fileValidators(info(100, 1_787_000_001_000)).etag).not.toBe(base)
  })

  it('answers a matching If-None-Match', () => {
    const v = fileValidators(info(100, 1_787_000_000_000))
    expect(isFresh(req({ 'if-none-match': v.etag }), v)).toBe(true)
    expect(isFresh(req({ 'if-none-match': `${v.etag}, W/"other"` }), v)).toBe(true)
    expect(isFresh(req({ 'if-none-match': 'W/"stale"' }), v)).toBe(false)
  })

  it('prefers If-None-Match over If-Modified-Since', () => {
    // mtime 只有秒级精度,同一秒内的两次改写它分辨不出来,而 ETag 带上了大小。
    const v = fileValidators(info(100, 1_787_000_000_000))
    expect(isFresh(req({ 'if-none-match': 'W/"stale"', 'if-modified-since': v.lastModified }), v)).toBe(false)
  })

  it('falls back to If-Modified-Since when no ETag was sent', () => {
    const v = fileValidators(info(100, 1_787_000_000_000))
    expect(isFresh(req({ 'if-modified-since': v.lastModified }), v)).toBe(true)
    expect(isFresh(req({ 'if-modified-since': new Date(1_786_000_000_000).toUTCString() }), v)).toBe(false)
    expect(isFresh(req({ 'if-modified-since': 'not a date' }), v)).toBe(false)
    expect(isFresh(req({}), v)).toBe(false)
  })

  it('gives article images no免问期 and materials five minutes', () => {
    // 智能体随时会重写文章配图,过期的封面比多一次条件请求难受得多。
    expect(imageCacheHeaders(info(1, 1_787_000_000_000), 0)['Cache-Control'])
      .toBe('private, max-age=0, must-revalidate')
    expect(imageCacheHeaders(info(1, 1_787_000_000_000), 300)['Cache-Control'])
      .toBe('private, max-age=300')
  })

  it('carries both validators on every image response', () => {
    const headers = imageCacheHeaders(info(1, 1_787_000_000_000), 300)
    expect(headers.ETag).toBeDefined()
    expect(headers['Last-Modified']).toBeDefined()
  })
})
