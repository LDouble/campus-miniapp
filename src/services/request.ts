import Taro from '@tarojs/taro'

export const API_BASE_URL = process.env.TARO_APP_API_BASE_URL || 'http://127.0.0.1:8080'

type Envelope<T> = { data: T; request_id: string }

export async function request<T>(path: string, options: Taro.request.Option = {}): Promise<T> {
  const accessToken = Taro.getStorageSync<string>('access_token')
  const response = await Taro.request<Envelope<T>>({
    url: `${API_BASE_URL}${path}`,
    timeout: 15000,
    ...options,
    header: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.header || {})
    }
  })
  if (response.statusCode < 200 || response.statusCode >= 300) {
    const error = (response.data as unknown as { error?: { message?: string } })?.error
    throw new Error(error?.message || `请求失败（${response.statusCode}）`)
  }
  return response.data.data
}

export function get<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' })
}

export function post<T>(path: string, data: unknown, idempotencyKey?: string): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    data,
    header: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined
  })
}
