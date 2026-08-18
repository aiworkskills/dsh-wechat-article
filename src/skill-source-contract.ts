export const SKILL_SOURCE_ROUTE = '/plugins/aiworkskills/wechat-article/skill-source'

export type SkillSourceState = 'missing' | 'installing' | 'updating' | 'ready' | 'invalid'

export interface SkillSourceStatus {
  readonly state: SkillSourceState
  readonly ready: boolean
  readonly repository: string
  readonly ref: string
  readonly issues: readonly string[]
}
