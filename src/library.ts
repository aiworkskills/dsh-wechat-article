/** Product knowledge-base and image-library service backed by `.aws-article/products`. */
import { Context, Service } from '@deepseek-ai/cordis'
import '@deepseek-ai/dsh-subprocess'
import z from '@deepseek-ai/schemastery'
import * as mutations from './domain/library/mutations.ts'
import { findDocuments, findImages, listProducts } from './domain/library/query.ts'
import { resolveWorkspace } from './domain/paths/workspace-paths.ts'
import { resolveSkillSourceDir, skillScript } from './skill-source.ts'

/** Deployment configuration for product-library reads and image ingestion. */
export interface Config {
  readonly pythonCommand?: string
  readonly maxDocumentBytes?: number
  readonly maxResults?: number
}

export const Config: z<Config> = z.object({
  pythonCommand: z.string().default('python3'),
  maxDocumentBytes: z.number().default(1_048_576),
  maxResults: z.number().default(50),
})

export type {
  ProductDocument,
  ProductImage,
  ProductSummary,
} from './domain/library/query.ts'

export type {
  ProductCategoryCreateRequest,
  ProductCategoryRenameRequest,
  ProductDocumentRenameRequest,
  ProductDocumentWriteRequest,
  ProductFileDeleteRequest,
  ProductImageRenameRequest,
} from './domain/library/mutations.ts'

/** Request passed to the original Skill's image-ingest script. */
export interface ImageIngestRequest {
  readonly workspace: string
  readonly sourcePath: string
  readonly product: string
  readonly stem: string
  readonly content?: string
  readonly signal?: AbortSignal
}

/** Successful stdout from the original image-ingest script. */
export interface ImageIngestResult {
  readonly output: string
}

function positiveInteger(label: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${label} must be a positive integer`)
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    wechatProductLibrary: WechatProductLibrary
  }
}

/** Read-only product discovery plus controlled delegation to the original ingest script. */
export class WechatProductLibrary extends Service {
  static inject = ['subprocess']
  static Config = Config

  private readonly pythonCommand: string
  private readonly limits: { readonly maxDocumentBytes: number; readonly maxResults: number }
  private readonly ingestScript: string

  constructor(ctx: Context, config: Config = {}) {
    super(ctx, 'wechatProductLibrary')
    this.pythonCommand = config.pythonCommand ?? 'python3'
    const maxDocumentBytes = config.maxDocumentBytes ?? 1_048_576
    const maxResults = config.maxResults ?? 50
    this.limits = { maxDocumentBytes, maxResults }
    this.ingestScript = skillScript(
      resolveSkillSourceDir(),
      'aws-wechat-article-assets',
      'product_image_ingest.py',
    )
    if (this.pythonCommand.trim().length === 0) throw new Error('pythonCommand must not be empty')
    positiveInteger('maxDocumentBytes', maxDocumentBytes)
    positiveInteger('maxResults', maxResults)
  }

  async listProducts(workspace: string) {
    return listProducts(workspace, this.limits)
  }

  async findDocuments(workspace: string, options: { readonly product?: string; readonly query?: string } = {}) {
    return findDocuments(workspace, this.limits, options)
  }

  async findImages(workspace: string, options: { readonly product?: string; readonly query?: string } = {}) {
    return findImages(workspace, this.limits, options)
  }

  async createDocument(request: mutations.ProductDocumentWriteRequest) {
    return mutations.createDocument(request, this.limits)
  }

  async createProduct(request: mutations.ProductCategoryCreateRequest) {
    return mutations.createProduct(request)
  }

  async renameProduct(request: mutations.ProductCategoryRenameRequest) {
    return mutations.renameProduct(request)
  }

  async renameDocument(request: mutations.ProductDocumentRenameRequest) {
    return mutations.renameDocument(request)
  }

  async renameImage(request: mutations.ProductImageRenameRequest) {
    return mutations.renameImage(request)
  }

  async deleteDocument(request: mutations.ProductFileDeleteRequest) {
    return mutations.deleteDocument(request)
  }

  async deleteImage(request: mutations.ProductFileDeleteRequest) {
    return mutations.deleteImage(request)
  }

  async ingestImage(request: ImageIngestRequest): Promise<ImageIngestResult> {
    const workspace = resolveWorkspace(request.workspace)
    const executable = await this.ctx.subprocess.resolveExecutable(
      this.pythonCommand,
      undefined,
      request.signal,
    )
    const argv = [
      executable,
      this.ingestScript,
      request.sourcePath,
      '--product',
      request.product,
      '--stem',
      request.stem,
      '--repo',
      workspace,
    ]
    if (request.content !== undefined && request.content.trim().length > 0) {
      argv.push('--content', request.content)
    }
    const handle = this.ctx.subprocess.spawn({
      argv,
      cwd: workspace,
      stdio: {
        stdin: 'ignore',
        stdout: { maxBytes: 64 * 1024 },
        stderr: { maxBytes: 64 * 1024 },
      },
      graceMs: 3_000,
      signal: request.signal,
    })
    const outcome = await handle.done
    const stdout = handle.collected.stdout?.readFrom(0).text ?? ''
    const stderr = handle.collected.stderr?.readFrom(0).text ?? ''
    if (outcome.exitCode !== 0) {
      throw new Error(stderr.trim() || `product image ingest exited with ${String(outcome.exitCode)}`)
    }
    return { output: stdout.trim() }
  }
}

export default WechatProductLibrary
