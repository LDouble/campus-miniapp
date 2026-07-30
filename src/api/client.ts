import Taro from '@tarojs/taro'
import {
  apiUrl,
  clearSession,
  ensureAccessToken,
  refreshAccessToken,
} from './auth'
import type { ApiErrorEnvelope, ApiSuccessEnvelope } from './types'
import { handleAcademicVerificationRequired } from '../features/academic-verification/guard'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

type RequestOptions = {
  path: string
  method?: HttpMethod
  data?: unknown
  query?: Record<string, string | number | boolean | null | undefined>
  idempotencyKey?: string
  anonymous?: boolean
  retryAfterRefresh?: boolean
  skipAcademicVerificationGuard?: boolean
}

export class ApiError extends Error {
  statusCode: number
  code: string
  requestId: string

  constructor(statusCode: number, code: string, message: string, requestId = '') {
    super(message)
    Object.setPrototypeOf(this, ApiError.prototype)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.code = code
    this.requestId = requestId
  }
}

const accessTokenErrorCodes = new Set([
  'missing_token',
  'invalid_access_token',
  'session_expired',
])

const queryString = (query?: RequestOptions['query']) => {
  if (!query) return ''
  const parts = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  return parts.length ? `?${parts.join('&')}` : ''
}

export const parseApiError = (statusCode: number, body: unknown) => {
  if (
    body
    && typeof body === 'object'
    && 'error' in body
    && body.error
    && typeof body.error === 'object'
    && 'code' in body.error
    && 'message' in body.error
  ) {
    const envelope = body as ApiErrorEnvelope
    return new ApiError(
      statusCode,
      String(envelope.error.code),
      String(envelope.error.message),
      String(envelope.request_id || ''),
    )
  }
  return new ApiError(statusCode, 'request_failed', '校园服务暂时不可用')
}

const throwApiError = async (error: ApiError, options: RequestOptions): Promise<never> => {
  if (
    error.code === 'academic_verification_required'
    && !options.skipAcademicVerificationGuard
  ) {
    try {
      await handleAcademicVerificationRequired()
    } catch {
      // 导航失败不能覆盖后端的原始业务错误。
    }
  }
  throw error
}

export const createIdempotencyKey = (scope: string) => {
  const random = Math.random().toString(36).slice(2, 12)
  return `${scope}:${Date.now().toString(36)}:${random}`.slice(0, 128)
}

export async function apiRequest<T>(options: RequestOptions): Promise<T> {
  const method = options.method || 'GET'
  const token = options.anonymous ? '' : await ensureAccessToken()
  const response = await Taro.request<ApiSuccessEnvelope<T> | ApiErrorEnvelope>({
    url: `${apiUrl(options.path)}${queryString(options.query)}`,
    method,
    data: options.data,
    header: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.idempotencyKey
        ? { 'Idempotency-Key': options.idempotencyKey }
        : {}),
    },
  })

  const responseError = response.statusCode < 200 || response.statusCode >= 300
    ? parseApiError(response.statusCode, response.data)
    : null
  if (
    response.statusCode === 401
    && responseError
    && accessTokenErrorCodes.has(responseError.code)
    && !options.anonymous
    && options.retryAfterRefresh !== false
  ) {
    try {
      await refreshAccessToken()
    } catch {
      clearSession()
      return throwApiError(responseError, options)
    }
    return apiRequest<T>({ ...options, retryAfterRefresh: false })
  }

  if (responseError) {
    return throwApiError(responseError, options)
  }
  if (!('data' in response.data)) {
    throw new ApiError(response.statusCode, 'invalid_response', '校园服务返回了无效数据')
  }
  return response.data.data
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError
