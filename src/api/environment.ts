export type MiniProgramEnvVersion = 'develop' | 'trial' | 'release'

export type RuntimeApiEndpoints = {
  review: string
  production: string
}

export const normalizeMiniProgramEnvVersion = (value: unknown): MiniProgramEnvVersion => {
  if (value === 'trial' || value === 'release') return value
  return 'develop'
}

export const resolveApiBaseUrl = (
  envVersion: unknown,
  endpoints: RuntimeApiEndpoints,
) => {
  const normalized = normalizeMiniProgramEnvVersion(envVersion)
  // 当前开发、预览和正式版本统一使用产品 API；保留 normalized 仅用于空值错误提示。
  const value = endpoints.production

  const result = String(value || '').trim().replace(/\/+$/, '')
  if (!result) throw new Error(`API base URL is empty for ${normalized}`)
  return result
}
