export type ApiEndpointEnvironment = {
  TARO_APP_API_BASE_URL?: string
  TARO_APP_REVIEW_API_BASE_URL?: string
  TARO_APP_PRODUCTION_API_BASE_URL?: string
}

export type ApiEndpoints = {
  review: string
  production: string
}

const localApiBaseUrl = 'http://127.0.0.1:8080'
export const defaultReviewApiBaseUrl = 'https://review.weouc.com'
export const defaultProductionApiBaseUrl = 'https://product.weouc.com'

const normalizeUrl = (value: string) => value.trim().replace(/\/+$/, '')

const canonicalEndpoint = (value: string) => {
  const parsed = new URL(value)
  return parsed.toString().replace(/\/+$/, '')
}

const validateIsolatedEndpoint = (name: keyof ApiEndpoints, value: string) => {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error(`TARO_APP_${name.toUpperCase()}_API_BASE_URL must be an absolute URL`)
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`TARO_APP_${name.toUpperCase()}_API_BASE_URL must use HTTPS`)
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(`TARO_APP_${name.toUpperCase()}_API_BASE_URL must not contain credentials, query, or hash`)
  }
}

export const loadApiEndpoints = (
  environment: ApiEndpointEnvironment,
  requireIsolation: boolean,
): ApiEndpoints => {
  const legacy = normalizeUrl(environment.TARO_APP_API_BASE_URL || localApiBaseUrl)
  const endpoints = {
    review: normalizeUrl(
      environment.TARO_APP_REVIEW_API_BASE_URL
      || (requireIsolation ? defaultReviewApiBaseUrl : legacy),
    ),
    production: normalizeUrl(
      environment.TARO_APP_PRODUCTION_API_BASE_URL
      || (requireIsolation ? defaultProductionApiBaseUrl : legacy),
    ),
  }

  if (!requireIsolation) return endpoints

  Object.entries(endpoints).forEach(([name, value]) => {
    validateIsolatedEndpoint(name as keyof ApiEndpoints, value)
  })
  if (new Set(Object.values(endpoints).map(canonicalEndpoint)).size !== 2) {
    throw new Error('review and production API URLs must be distinct')
  }
  return endpoints
}
