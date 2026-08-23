import { defineConfig } from 'vitest/config'

/**
 * 测试范围限定在 tests/ 目录。
 *
 * 仓库根下的 `.harness` 是指向 DeepSeek Harness 源码检出的符号链接
 * (由 scripts/link-harness.mjs 建立,构建客户端 bundle 时需要)。vitest 默认
 * 的排除列表只覆盖 node_modules、dist 这类目录,不认识这个链接,于是会顺着它
 * 把整个 Harness 仓库的测试一并收进来 —— 本插件自己只有十几个测试文件,却会
 * 跑出近万个用例,其中大量因为解析不到 Harness 自己的依赖而失败。
 *
 * 用 include 明确圈定范围,比往 exclude 里追加更不容易随目录变化失效。
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    server: {
      deps: {
        // Harness 的客户端包会从 JS 里导入 CSS Module。这类包必须走 vite 的转换
        // 管线才能处理样式导入;被外部化交给 Node 原生 ESM 加载时,会直接抛
        // "Unknown file extension .css"。
        //
        // 正则不加 ^ 锚定:pnpm 下匹配的是形如
        // node_modules/.pnpm/@deepseek-ai+dsh-client-ui-primitives@.../... 的完整
        // 路径,锚在开头会匹配不到。
        inline: [/@deepseek-ai[+/]/],
      },
    },
  },
})
