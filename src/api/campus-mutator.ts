import Taro from '@tarojs/taro'

export type ErrorType<Error> = Error
export type BodyType<BodyData> = BodyData
type RequestConfig = { url?: string; method?: string; params?: Record<string, unknown>; data?: unknown; headers?: Record<string, string> }
type ErrorPayload = { error?: { code?: string; message?: string } }
type TokenPayload = { data?: { access_token?: string; refresh_token?: string } }

const ACCESS_TOKEN_KEY = 'access_token'
const REFRESH_TOKEN_KEY = 'refresh_token'
let refreshPromise: Promise<string> | null = null

function query(params?: Record<string, unknown>) {
  if (!params) return ''
  const value = Object.entries(params).filter(([, item]) => item !== undefined && item !== null).map(([key, item]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`).join('&')
  return value ? `?${value}` : ''
}

function baseURL () {
  return process.env.TARO_APP_API_BASE_URL || 'http://127.0.0.1:8080'
}

export function createIdempotencyKey () {
  return `miniapp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function isAuthenticatedWrite (config: RequestConfig, token: string) {
  const method = (config.method || 'GET').toUpperCase()
  return Boolean(token) && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !String(config.url || '').startsWith('/api/v1/auth/')
}

function clearLoginState () {
  Taro.removeStorageSync(ACCESS_TOKEN_KEY)
  Taro.removeStorageSync(REFRESH_TOKEN_KEY)
}

async function refreshAccessToken () {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    const refreshToken = Taro.getStorageSync<string>(REFRESH_TOKEN_KEY)
    if (!refreshToken) throw new Error('登录已过期，请重新登录')
    const response = await Taro.request<TokenPayload & ErrorPayload>({
      url: `${baseURL()}/api/v1/auth/refresh`,
      method: 'POST',
      data: { refresh_token: refreshToken },
      header: { 'Content-Type': 'application/json' }
    })
    const tokens = response.data && response.data.data
    if (response.statusCode < 200 || response.statusCode >= 300 || !tokens || !tokens.access_token || !tokens.refresh_token) {
      throw new Error((response.data && response.data.error && response.data.error.message) || '登录已过期，请重新登录')
    }
    Taro.setStorageSync(ACCESS_TOKEN_KEY, tokens.access_token)
    Taro.setStorageSync(REFRESH_TOKEN_KEY, tokens.refresh_token)
    return tokens.access_token
  })().catch(error => {
    clearLoginState()
    throw error
  }).finally(() => {
    refreshPromise = null
  })
  return refreshPromise
}

async function send<T> (config: RequestConfig, token: string, retried: boolean): Promise<T> {
  const headers = { 'Content-Type': 'application/json', ...(config.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  if (isAuthenticatedWrite(config, token) && !headers['Idempotency-Key']) headers['Idempotency-Key'] = createIdempotencyKey()
  const response = await Taro.request<T & ErrorPayload>({
    url: `${baseURL()}${config.url || ''}${query(config.params)}`,
    method: (config.method || 'GET').toUpperCase() as keyof Taro.request.Method,
    data: config.data,
    header: headers
  })
  if (response.statusCode === 401 && !retried && !String(config.url || '').startsWith('/api/v1/auth/')) {
    const nextToken = await refreshAccessToken()
    return send<T>({ ...config, headers }, nextToken, true)
  }
  if (response.statusCode < 200 || response.statusCode >= 300) {
    const message = response.data && response.data.error && response.data.error.message
    if (response.statusCode === 409) throw new Error(message || '内容已被更新，请刷新后重试')
    if (response.statusCode === 403) throw new Error(message || '当前账号没有执行此操作的权限')
    throw new Error(message || `请求失败（${response.statusCode}）`)
  }
  return response.data as T
}

export async function campusRequest<T> (config: RequestConfig): Promise<T> {
  const token = Taro.getStorageSync<string>(ACCESS_TOKEN_KEY)
  return send<T>(config, token, false)
}
