/** Model tools for reading and maintaining the project product library. */
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import './configuration.ts'

function workspaceOf(exec: { readonly agent?: { readonly session: { readonly header: { readonly cwd?: string } } } }): string {
  const cwd = exec.agent?.session.header.cwd
  if (cwd === undefined) throw new Error('this tool requires an agent session with an absolute workspace cwd')
  return cwd
}

/** Cordis plugin name. */
export const name = 'aiworkskills-wechat-product-tools'
/** Services consumed by the product-library tool suite. */
export const inject = ['tools', 'wechatProductLibrary', 'wechatArticleConfiguration']

async function configuredWorkspace(
  ctx: Context,
  exec: { readonly signal?: AbortSignal; readonly agent?: { readonly session: { readonly header: { readonly cwd?: string } } } },
): Promise<string> {
  const workspace = workspaceOf(exec)
  await ctx.wechatArticleConfiguration.assertReady(workspace, exec.signal)
  return workspace
}

/** Register product listing, document search, image search and image ingestion tools. */
export function apply(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'wechat_products_list',
    description: 'List the user business/product directories in the current project .aws-article/products library. Use only when the task concerns the user\'s own business, product, service, tutorial, or case.',
    parameters: {},
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          products: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                name: { type: 'string', required: true },
                documentCount: { type: 'integer', required: true },
                imageCount: { type: 'integer', required: true },
              },
            },
          },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.products.length === 0
          ? 'No product library was found in this workspace.'
          : `Found ${value.products.length} product entries.`,
      }],
    },
    async execute(_args, exec) {
      return { products: await ctx.wechatProductLibrary.listProducts(await configuredWorkspace(ctx, exec)) }
    },
    presentCall: () => ({ card: 'generic', title: 'List product library', kind: 'search', rawInput: {} }),
  }))

  ctx.tools.register(defineTool({
    name: 'wechat_product_documents',
    description: 'Read or search root-level Markdown knowledge documents in .aws-article/products. Do not use for generic news or tutorials unrelated to the user\'s own business.',
    parameters: {
      product: { type: 'string', description: 'Exact product directory name. Omit to search all products.' },
      query: { type: 'string', description: 'Optional case-insensitive text filter over product, filename, title, and content.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          documents: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                product: { type: 'string', required: true },
                path: { type: 'string', required: true },
                title: { type: 'string', required: true },
                content: { type: 'string', required: true },
              },
            },
          },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.documents.length === 0
          ? 'No matching product documents.'
          : `Read ${value.documents.length} product documents:\n${value.documents.map(item => item.path).join('\n')}`,
      }],
    },
    async execute(args, exec) {
      const workspace = await configuredWorkspace(ctx, exec)
      return {
        documents: await ctx.wechatProductLibrary.findDocuments(workspace, {
          ...(args.product === undefined ? {} : { product: args.product }),
          ...(args.query === undefined ? {} : { query: args.query }),
        }),
      }
    },
    presentCall: args => ({ card: 'generic', title: 'Search product knowledge', kind: 'search', rawInput: args }),
  }))

  ctx.tools.register(defineTool({
    name: 'wechat_product_images',
    description: 'Search body-image candidates in .aws-article/products using their same-stem Markdown descriptions. Product-library images are not eligible as article covers.',
    parameters: {
      product: { type: 'string', description: 'Exact product directory name. Omit to search all products.' },
      query: { type: 'string', description: 'Optional case-insensitive filter over product, filename, and image description.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          images: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                product: { type: 'string', required: true },
                imagePath: { type: 'string', required: true },
                descriptionPath: { oneOf: [{ type: 'string' }, { type: 'null' }], required: true },
                description: { type: 'string', required: true },
              },
            },
          },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.images.length === 0
          ? 'No matching product images.'
          : `Found ${value.images.length} body-image candidates:\n${value.images.map(item => item.imagePath).join('\n')}`,
      }],
    },
    async execute(args, exec) {
      const workspace = await configuredWorkspace(ctx, exec)
      return {
        images: await ctx.wechatProductLibrary.findImages(workspace, {
          ...(args.product === undefined ? {} : { product: args.product }),
          ...(args.query === undefined ? {} : { query: args.query }),
        }),
      }
    },
    presentCall: args => ({ card: 'generic', title: 'Search product images', kind: 'search', rawInput: args }),
  }))

  ctx.tools.register(defineTool({
    name: 'wechat_product_image_ingest',
    description: 'Copy a local product image into .aws-article/products/{product}/images and create its canonical same-stem Markdown description. Analyze the image first and provide an objective Chinese stem and description.',
    parameters: {
      sourcePath: { type: 'string', required: true, description: 'Local path to an existing png, jpg, jpeg, webp, or gif image.' },
      product: { type: 'string', required: true, description: 'Product library directory name.' },
      stem: { type: 'string', required: true, description: 'Objective Chinese image filename without extension.' },
      description: { type: 'string', required: true, description: 'Objective Chinese description of visible image content.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: { output: { type: 'string', required: true } },
      },
      render: (_args, value) => [{ type: 'text', text: value.output }],
    },
    async execute(args, exec) {
      const workspace = await configuredWorkspace(ctx, exec)
      return ctx.wechatProductLibrary.ingestImage({
        workspace,
        sourcePath: args.sourcePath,
        product: args.product,
        stem: args.stem,
        content: args.description,
        signal: exec.signal,
      })
    },
    presentCall: args => ({
      card: 'generic',
      title: 'Add product image',
      kind: 'other',
      rawInput: { product: args.product, stem: args.stem, sourcePath: args.sourcePath },
    }),
  }))
}
