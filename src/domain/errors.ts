/**
 * User-facing input or validation failure.
 *
 * 它存在的意义就是把「用户填错了」和「服务端出问题了」分开。HTTP 状态码由
 * 路由层的 `mapRouteError` 决定 —— 领域层不该知道有 HTTP 这回事。
 */
export class UserInputError extends Error {
  override readonly name = 'UserInputError'
}
