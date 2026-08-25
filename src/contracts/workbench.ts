/** Facts about this plugin's UI placement that a deployment may need to reason about. */

/**
 * 工作台在 `details` 槽位的遮蔽档位（升序，最低者渲染，默认 0）。
 *
 * 工作台是**常驻**面板：会话期间一直占着这个位置，所以取一个略低于默认档的值。
 *
 * 导出成常量而不是写死在注册处，是因为这个数字是装配时的事实：DSH 在同一槽位、
 * 同一档位上的第二次注册会直接抛错并指名占用者。一个同时装了别的 details 面板的
 * 部署，需要能读到这个值才知道会不会撞、以及谁在前面。
 */
export const WORKBENCH_DETAILS_PRIORITY = -10
