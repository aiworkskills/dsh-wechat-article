import type { Context } from '@deepseek-ai/cordis'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import { describe, expect, it } from 'vitest'
import { apply } from '../src/tools.js'

describe('product-library tool consumer', () => {
  it('registers four focused tools and preserves the cover-image restriction', () => {
    const definitions: ToolDefinition[] = []
    const ctx = {
      tools: {
        register(definition: ToolDefinition) {
          definitions.push(definition)
          return () => {}
        },
      },
      wechatProductLibrary: {},
    } as unknown as Context

    apply(ctx)

    expect(definitions.map(definition => definition.name)).toEqual([
      'wechat_products_list',
      'wechat_product_documents',
      'wechat_product_images',
      'wechat_product_image_ingest',
    ])
    expect(definitions.find(definition => definition.name === 'wechat_product_images')?.description)
      .toContain('not eligible as article covers')
  })
})
