/**
 * 把本仓库指向一份 DeepSeek Harness 源码检出。
 *
 * 为什么需要源码而不是 npm 包:客户端 bundle 的构建预设
 * `packages/client/tsdown.client.ts` 位于 Harness 仓库的目录层级上,不属于任何
 * 一个包,因而不会随 npm 发布;`packages/client/web/src/platform.ts` 导出的是
 * 构建期需要的**值**,而发布包里只有 `lib/types/platform.d.ts` 类型声明。
 * 详见 build/harness-tsdown-patch.ts 的说明。
 *
 * 以前这个位置是写死的相对路径 `../../deepseek-harness`,等于把仓库的目录布局
 * 变成了构建的隐含前提:只要不按 README 那样摆放(容器构建、CI、monorepo、
 * 自定义工作区都不会),构建就会失败,而且失败现场极具误导性 —— tsc 因为解析
 * 不到类型,抛出三十行 TS7006 "implicitly has an 'any' type",只字不提
 * Harness 找不到。
 *
 * 现在改为:路径可由 DSH_SOURCE_ROOT 指定,缺省仍是原来的相对位置(所以按
 * README 布局的用户无感),并在这里把路径解析成一个稳定的 `.harness` 符号链接,
 * 供构建脚本以固定路径引用 —— 这样静态 import 和类型推导都完整保留。
 */
import { existsSync, lstatSync, readFileSync, readlinkSync, rmSync, symlinkSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** 相对插件根目录的缺省位置,与本项目 README 的目录布局一致。 */
const DEFAULT_HARNESS_ROOT = resolve(PLUGIN_ROOT, '../../deepseek-harness')

/** 构建期真正需要、且 npm 包里拿不到的文件。缺任何一个都说明这不是一份可用的检出。 */
const REQUIRED_SOURCES = [
  'packages/client/tsdown.client.ts',
  'packages/client/web/src/platform.ts',
]

const LINK_PATH = join(PLUGIN_ROOT, '.harness')

function fail(message) {
  console.error(`\n[link-harness] ${message}\n`)
  process.exit(1)
}

function resolveHarnessRoot() {
  const fromEnv = process.env.DSH_SOURCE_ROOT?.trim()
  if (fromEnv) return { root: resolve(fromEnv), source: 'DSH_SOURCE_ROOT' }
  return { root: DEFAULT_HARNESS_ROOT, source: '默认相对路径' }
}

const { root, source } = resolveHarnessRoot()

if (!existsSync(root)) {
  fail(
    `找不到 DeepSeek Harness 源码目录:${root}\n`
    + `  (来源:${source})\n\n`
    + '构建客户端 bundle 需要一份 Harness 源码检出 —— 它包含的构建预设没有随 npm 发布。\n'
    + '请任选其一:\n'
    + `  1. 把 Harness 克隆到 ${DEFAULT_HARNESS_ROOT}\n`
    + '  2. 或指定位置:DSH_SOURCE_ROOT=/path/to/deepseek-harness pnpm build',
  )
}

const missing = REQUIRED_SOURCES.filter(relative => !existsSync(join(root, relative)))
if (missing.length > 0) {
  fail(
    `${root} 看起来不是一份完整的 Harness 源码检出,缺少:\n`
    + missing.map(item => `  - ${item}`).join('\n')
    + '\n\n如果指向的是已发布的 npm 包或裁剪过的目录,请换成完整的 git 检出。',
  )
}

// 版本一致性检查。类型来自 npm 上的 peerDependencies 版本,构建预设来自这份源码
// 检出 —— 两者不一致会产生"类型对不上构建产物"的割裂现象,且报错通常指向别处,
// 所以在这里提前点明,但不阻断:上游开发者本来就会在改动中的 Harness 上构建。
try {
  const peer = JSON.parse(readFileSync(join(PLUGIN_ROOT, 'package.json'), 'utf8')).peerDependencies ?? {}
  const expected = peer['@deepseek-ai/dsh-tools']
  const actual = JSON.parse(readFileSync(join(root, 'packages/core/tools/package.json'), 'utf8')).version
  if (expected && actual && expected !== actual) {
    console.warn(
      `[link-harness] 注意:Harness 检出版本为 ${actual},而本插件按 ${expected} 声明依赖。\n`
      + '              版本不一致时,构建产物可能与类型定义不符。',
    )
  }
} catch {
  // 版本探测失败不应该拖垮构建 —— 上面的文件存在性检查才是硬性前提。
}

// 符号链接指向别处时先删掉重建;若已正确则原地返回,保持构建可重复执行。
if (existsSync(LINK_PATH) || lstatSync(LINK_PATH, { throwIfNoEntry: false })) {
  const current = lstatSync(LINK_PATH, { throwIfNoEntry: false })
  if (current?.isSymbolicLink() && resolve(PLUGIN_ROOT, readlinkSync(LINK_PATH)) === root) {
    console.log(`[link-harness] 已指向 ${root}`)
    process.exit(0)
  }
  rmSync(LINK_PATH, { recursive: true, force: true })
}

symlinkSync(root, LINK_PATH, 'junction')
console.log(`[link-harness] .harness → ${root}  (来源:${source})`)
