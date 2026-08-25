import { outOfTreeClientBundle } from './build/harness-tsdown-patch.ts'

/**
 * 只有两个 node 半侧入口。
 *
 * `.` 是 Cordis 组合根，`./contracts` 是浏览器半侧与外部工具共享的词汇 —— 它必须
 * 单独成包，因为客户端 bundle 不能拉进任何 Host 侧代码。其余模块由 `.` 内联，
 * 因而是实现细节：改它们的位置和名字不构成破坏性变更。
 */
export default outOfTreeClientBundle('@aiworkskills/aws-wechat-article', [
    'src/index.ts',
    'src/contracts.ts',
  ])
