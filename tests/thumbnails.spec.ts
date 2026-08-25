import { describe, expect, it } from 'vitest'
import {
  createThumbnailCache, THUMBNAIL_SIZE, thumbnailKey,
} from '../src/domain/images/thumbnails.js'
import { wantsThumbnail } from '../src/host/routes/shared/http.js'

const blob = (bytes: number): Buffer => Buffer.alloc(bytes, 1)

describe('thumbnail cache key', () => {
  it('folds mtime in, so a changed source can never hit a stale entry', () => {
    // 失效不需要任何代码:源图一改键就变了,旧条目自然再也命中不到。
    const before = thumbnailKey('/w/a.jpg', 1_787_000_000_000)
    expect(thumbnailKey('/w/a.jpg', 1_787_000_000_000)).toBe(before)
    expect(thumbnailKey('/w/a.jpg', 1_787_000_001_000)).not.toBe(before)
    expect(thumbnailKey('/w/b.jpg', 1_787_000_000_000)).not.toBe(before)
  })

  it('ignores sub-millisecond drift so one file is one entry', () => {
    expect(thumbnailKey('/w/a.jpg', 1_787_000_000_000.7))
      .toBe(thumbnailKey('/w/a.jpg', 1_787_000_000_000))
  })

  it('keeps the size out of the caller’s hands', () => {
    expect(THUMBNAIL_SIZE).toBe(96)
    expect(thumbnailKey('/w/a.jpg', 1)).toContain('96')
  })
})

describe('thumbnail cache', () => {
  it('evicts by bytes, not by entry count', () => {
    // 一百张 2 KB 和一百张 2 MB 占用差三个数量级,"最多存 N 张"对两者一视同仁。
    const cache = createThumbnailCache(1000)
    cache.set('a', blob(400))
    cache.set('b', blob(400))
    expect(cache.size).toBe(2)
    cache.set('c', blob(400))
    expect(cache.bytes).toBeLessThanOrEqual(1000)
    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('c')).toBeDefined()
  })

  it('evicts least-recently-used, and reading counts as use', () => {
    const cache = createThumbnailCache(1000)
    cache.set('a', blob(400))
    cache.set('b', blob(400))
    cache.get('a')
    cache.set('c', blob(400))
    expect(cache.get('a')).toBeDefined()
    expect(cache.get('b')).toBeUndefined()
  })

  it('refuses an entry that alone exceeds the budget', () => {
    // 存了也只会立刻把别人全挤掉。
    const cache = createThumbnailCache(1000)
    cache.set('a', blob(400))
    cache.set('huge', blob(5000))
    expect(cache.get('huge')).toBeUndefined()
    expect(cache.get('a')).toBeDefined()
  })

  it('replaces an existing key without double-counting its bytes', () => {
    const cache = createThumbnailCache(1000)
    cache.set('a', blob(300))
    cache.set('a', blob(300))
    expect(cache.size).toBe(1)
    expect(cache.bytes).toBe(300)
  })

  it('refuses a nonsensical budget rather than silently caching nothing', () => {
    expect(() => createThumbnailCache(0)).toThrow(/positive integer/)
    expect(() => createThumbnailCache(-1)).toThrow(/positive integer/)
  })
})

describe('thumbnail request parsing', () => {
  const route = '/plugins/aiworkskills/wechat-article/article-file'

  it('reads the switch, and only the switch', () => {
    expect(wantsThumbnail(`${route}?sessionId=s&path=a.jpg&thumb=1`, route)).toBe(true)
    expect(wantsThumbnail(`${route}?sessionId=s&path=a.jpg`, route)).toBe(false)
    // 任意宽度会让缓存键无界,而每次未命中都要拉起一次解码 —— 那是个放大器。
    expect(wantsThumbnail(`${route}?thumb=4096`, route)).toBe(false)
    expect(wantsThumbnail(`${route}?thumb=true`, route)).toBe(false)
    expect(wantsThumbnail('', route)).toBe(false)
  })
})
