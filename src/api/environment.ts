export type MiniProgramEnvVersion = 'develop' | 'trial' | 'release'

export type RuntimeApiEndpoints = {
  review: string
  staging: string
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
  let value = endpoints.review
  if (normalized === 'trial') value = endpoints.staging
  if (normalized === 'release') value = endpoints.production

  const result = String(value || '').trim().replace(/\/+$/, '')
  if (!result) throw new Error(`API base URL is empty for ${normalized}`)
  return result
}
