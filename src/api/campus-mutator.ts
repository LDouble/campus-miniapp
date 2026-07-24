import Taro from '@tarojs/taro'

export type ErrorType<Error> = Error
export type BodyType<BodyData> = BodyData
type RequestConfig = { url?: string; method?: string; params?: Record<string, unknown>; data?: unknown; headers?: Record<string, string> }

function query(params?: Record<string, unknown>) {
  if (!params) return ''
  const value = Object.entries(params).filter(([, item]) => item !== undefined && item !== null).map(([key, item]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`).join('&')
  return value ? `?${value}` : ''
}

export async function campusRequest<T>(config: RequestConfig): Promise<T> {
  const token = Taro.getStorageSync<string>('access_token')
  const response = await Taro.request<{ data: T; error?: { message?: string } }>({
    url: `${process.env.TARO_APP_API_BASE_URL || 'http://127.0.0.1:8080'}${config.url || ''}${query(config.params)}`,
    method: (config.method || 'GET').toUpperCase() as Taro.request.Method,
    data: config.data,
    header: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(config.headers || {}) }
  })
  if (response.statusCode < 200 || response.statusCode >= 300) throw new Error(response.data?.error?.message || `请求失败（${response.statusCode}）`)
  return response.data as T
}
