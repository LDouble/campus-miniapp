import Taro from '@tarojs/taro'
import {
  apiUrl,
  clearSession,
  ensureAccessToken,
  refreshAccessToken,
} from './auth'
import type {
  AcademicCacheMetadata,
  ApiErrorEnvelope,
  ApiSuccessEnvelope,
} from './types'
import { handleAcademicVerificationRequired } from '../features/academic-verification/guard'
import { reportClientError } from '../features/error-reporting'

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

export type ApiSuccessResponse<T> = {
  data: T
  requestId: string
  cache?: AcademicCacheMetadata
}

export class ApiError extends Error {
  statusCode: number
  code: string
  requestId: string
  details: unknown
  retryAfterMs: number

  constructor(
    statusCode: number,
    code: string,
    message: string,
    requestId = '',
    details: unknown = null,
    retryAfterMs = 0,
  ) {
    super(message)
    Object.setPrototypeOf(this, ApiError.prototype)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.code = code
    this.requestId = requestId
    this.details = details
    this.retryAfterMs = retryAfterMs
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

const parseRetryAfterMs = (headers?: Record<string, unknown>) => {
  if (!headers) return 0
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === 'retry-after')
  if (!entry) return 0
  const seconds = Number(entry[1])
  if (!Number.isFinite(seconds) || seconds <= 0) return 0
  return Math.min(Math.ceil(seconds * 1000), 60_000)
}

export const parseApiError = (
  statusCode: number,
  body: unknown,
  headers?: Record<string, unknown>,
) => {
  const retryAfterMs = parseRetryAfterMs(headers)
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
      null,
      retryAfterMs,
    )
  }
  if (body && typeof body === 'object' && 'data' in body) {
    const requestId = 'request_id' in body ? String(body.request_id || '') : ''
    return new ApiError(
      statusCode,
      statusCode === 409 ? 'request_conflict' : 'request_failed',
      statusCode === 409 ? '当前状态已变化，请刷新后重试' : '校园服务暂时不可用',
      requestId,
      body.data,
      retryAfterMs,
    )
  }
  return new ApiError(
    statusCode,
    'request_failed',
    '校园服务暂时不可用',
    '',
    null,
    retryAfterMs,
  )
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

export async function apiRequestEnvelope<T>(options: RequestOptions): Promise<ApiSuccessResponse<T>> {
  const method = options.method || 'GET'
  const token = options.anonymous ? '' : await ensureAccessToken()
  let response: Taro.request.SuccessCallbackResult<ApiSuccessEnvelope<T> | ApiErrorEnvelope>
  try {
    response = await Taro.request<ApiSuccessEnvelope<T> | ApiErrorEnvelope>({
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
  } catch (error) {
    void reportClientError({
      kind: 'network_error',
      route: options.path,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    throw error
  }

  if (response.statusCode >= 500) {
    const requestId = response.data && typeof response.data === 'object' && 'request_id' in response.data
      ? String(response.data.request_id || '')
      : ''
    void reportClientError({
      kind: 'http_5xx',
      route: options.path,
      message: `API request failed with status ${response.statusCode}`,
      requestId,
      statusCode: response.statusCode,
    })
  }

  const responseError = response.statusCode < 200 || response.statusCode >= 300
    ? parseApiError(response.statusCode, response.data, response.header)
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
    return apiRequestEnvelope<T>({ ...options, retryAfterRefresh: false })
  }

  if (responseError) {
    return throwApiError(responseError, options)
  }
  if (!('data' in response.data)) {
    void reportClientError({
      kind: 'invalid_response',
      route: options.path,
      message: 'API response envelope is missing data',
      statusCode: response.statusCode,
    })
    throw new ApiError(response.statusCode, 'invalid_response', '校园服务返回了无效数据')
  }
  return {
    data: response.data.data,
    requestId: String(response.data.request_id || ''),
    ...(response.data.cache ? { cache: response.data.cache } : {}),
  }
}

export async function apiRequest<T>(options: RequestOptions): Promise<T> {
  const response = await apiRequestEnvelope<T>(options)
  return response.data
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError
