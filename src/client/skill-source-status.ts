import { SKILL_SOURCE_ROUTE, type SkillSourceStatus } from '../skill-source-contract.ts'

function isStatus(value: unknown): value is SkillSourceStatus {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<SkillSourceStatus>
  return (candidate.state === 'missing' || candidate.state === 'installing' || candidate.state === 'updating'
    || candidate.state === 'ready' || candidate.state === 'invalid')
    && typeof candidate.ready === 'boolean'
    && typeof candidate.repository === 'string'
    && typeof candidate.ref === 'string'
    && Array.isArray(candidate.issues)
    && candidate.issues.every(issue => typeof issue === 'string')
}

async function readStatus(response: Response): Promise<SkillSourceStatus> {
  const value: unknown = await response.json()
  if (!response.ok) {
    const message = typeof value === 'object' && value !== null && 'message' in value
      ? String((value as { message: unknown }).message)
      : `Skill 同步请求失败（${response.status}）`
    throw new Error(message)
  }
  if (!isStatus(value)) throw new Error('Skill 状态响应格式无效')
  return value
}

export async function fetchSkillSourceStatus(signal?: AbortSignal): Promise<SkillSourceStatus> {
  return readStatus(await fetch(SKILL_SOURCE_ROUTE, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'same-origin',
    ...(signal === undefined ? {} : { signal }),
  }))
}

export async function synchronizeSkillSource(): Promise<SkillSourceStatus> {
  return readStatus(await fetch(SKILL_SOURCE_ROUTE, {
    method: 'POST',
    cache: 'no-store',
    credentials: 'same-origin',
  }))
}
