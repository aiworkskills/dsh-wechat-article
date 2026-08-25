/**
 * 缩略图服务：把几百 KB 的原图变成几 KB，只在真的需要时。
 *
 * 面板里的缩略图是二十几个像素见方，喂给它们的却是原图 —— 一个真实工作区里量到
 * 一篇文章 6 张配图 3.0 MB。懒加载与条件请求治的是"重复下载"和"一次全下"，
 * 而第一次看到一张图仍要付全价，这里治的是这一项。
 *
 * 三个刻意的选择：
 *
 * **降级而不是报错。** 生成失败（没装 Pillow、图片损坏、python 不在）一律返回
 * null，由调用方原样发原图。缩略图是优化，不是能力：它坏掉的正确表现是"变慢"，
 * 不是"看不见图"。一个通用插件不该因为某个部署没装 Pillow 就少一块界面。
 *
 * **走 base64 而不是临时文件。** 二进制经 stdout 会被当文本读坏，而落临时文件
 * 要处理清理、并发同名与写到一半被读。几 KB 的图多编码 33% 换掉这些，划算。
 *
 * **缓存在内存里。** 见 domain/images/thumbnails.ts 的说明。
 */
import { dirname } from 'node:path'
import { Context, Service } from '@deepseek-ai/cordis'
import '@deepseek-ai/dsh-subprocess'
import { createThumbnailCache, THUMBNAIL_SIZE, thumbnailKey, type ThumbnailCache } from '../domain/images/thumbnails.ts'

/** 默认 8 MiB。96px 的 JPEG 通常两三 KB，这够放上千张。 */
const DEFAULT_CACHE_BYTES = 8 * 1024 * 1024

/**
 * 生成脚本。`draft()` 是这里的关键：JPEG 解码时就按比例降采样，
 * 大图省掉的是整张位图的解码时间与内存，而不是解完再缩。
 */
const SCRIPT = [
  'import sys,base64,io',
  'from PIL import Image',
  'src,size=sys.argv[1],int(sys.argv[2])',
  'im=Image.open(src)',
  'im.draft("RGB",(size,size))',
  'im.thumbnail((size,size))',
  'buf=io.BytesIO()',
  'im.convert("RGB").save(buf,"JPEG",quality=72,optimize=True)',
  'sys.stdout.write(base64.b64encode(buf.getvalue()).decode())',
].join('\n')

declare module '@deepseek-ai/cordis' {
  interface Context {
    wechatThumbnails: WechatThumbnails
  }
}

export interface Config {
  readonly pythonCommand?: string
  /** 缩略图内存缓存上限（字节）。 */
  readonly thumbnailCacheBytes?: number
}

export class WechatThumbnails extends Service {
  static inject = ['subprocess']

  private readonly pythonCommand: string
  private readonly cache: ThumbnailCache
  /** 同一张图的并发请求共用一次生成 —— 面板一开就是一批并发。 */
  private readonly inFlight = new Map<string, Promise<Buffer | null>>()

  constructor(ctx: Context, config: Config = {}) {
    super(ctx, 'wechatThumbnails')
    this.pythonCommand = config.pythonCommand ?? 'python3'
    this.cache = createThumbnailCache(config.thumbnailCacheBytes ?? DEFAULT_CACHE_BYTES)
  }

  /**
   * 取这张图的缩略图；拿不到就返回 null。
   * @param path - 已经收敛过的绝对路径。
   * @param mtimeMs - 源文件修改时间，构成缓存键，因而无需显式失效。
   */
  async render(path: string, mtimeMs: number, signal?: AbortSignal): Promise<Buffer | null> {
    const key = thumbnailKey(path, mtimeMs)
    const hit = this.cache.get(key)
    if (hit !== undefined) return hit

    const running = this.inFlight.get(key)
    if (running !== undefined) return await running

    const work = this.generate(path, signal)
      .then(value => {
        if (value !== null) this.cache.set(key, value)
        return value
      })
      .catch(() => null)
      .finally(() => { this.inFlight.delete(key) })
    this.inFlight.set(key, work)
    return await work
  }

  private async generate(path: string, signal?: AbortSignal): Promise<Buffer | null> {
    const executable = await this.ctx.subprocess.resolveExecutable(this.pythonCommand, undefined, signal)
    const handle = this.ctx.subprocess.spawn({
      argv: [executable, '-c', SCRIPT, path, String(THUMBNAIL_SIZE)],
      // 脚本只用绝对路径,cwd 不参与寻址;给源图所在目录是最无意外的一个。
      cwd: dirname(path),
      stdio: {
        stdin: 'ignore',
        // base64 之后仍然放得下 96px 的 JPEG，几个数量级的余量。
        stdout: { maxBytes: 2 * 1024 * 1024 },
        stderr: { maxBytes: 8 * 1024 },
      },
      graceMs: 3_000,
      signal,
    })
    const outcome = await handle.done
    if (outcome.exitCode !== 0) return null
    const encoded = handle.collected.stdout?.readFrom(0).text.trim() ?? ''
    if (encoded === '') return null
    const decoded = Buffer.from(encoded, 'base64')
    return decoded.byteLength === 0 ? null : decoded
  }
}

export default WechatThumbnails
