import Taro from '@tarojs/taro'

type RequestStatus = number | 'NETWORK_ERROR' | 'UNKNOWN'
type RequestInterceptor = Parameters<typeof Taro.addInterceptor>[0]

export interface RequestLogEntry {
  method: string
  interface: string
  status: RequestStatus
  durationMs: number
}

let installed = false
const suppressedRequestUrls = new Map<string, number>()

/** 执行不应留下请求元数据日志的敏感直传，并覆盖同 URL 并发请求。 */
export const withoutRequestLogging = async <T>(url: string, operation: () => Promise<T>): Promise<T> => {
  suppressedRequestUrls.set(url, (suppressedRequestUrls.get(url) || 0) + 1)
  try {
    return await operation()
  } finally {
    const remaining = (suppressedRequestUrls.get(url) || 1) - 1
    if (remaining > 0) suppressedRequestUrls.set(url, remaining)
    else suppressedRequestUrls.delete(url)
  }
}

export const sanitizeRequestInterface = (url: string) => {
  const withoutOrigin = String(url || '').replace(/^https?:\/\/[^/]+/i, '')
  return withoutOrigin.split(/[?#]/, 1)[0] || '/'
}

const responseStatus = (response: unknown): RequestStatus => {
  if (
    response
    && typeof response === 'object'
    && 'statusCode' in response
    && typeof response.statusCode === 'number'
  ) {
    return response.statusCode
  }
  return 'UNKNOWN'
}

const printRequestLog = (entry: RequestLogEntry) => {
  console.info('[API 请求]', entry)
}

const requestLoggingInterceptor: RequestInterceptor = (chain) => {
  const requestParams = chain.requestParams
  if (suppressedRequestUrls.has(String(requestParams.url || ''))) {
    return chain.proceed(requestParams)
  }
  const startedAt = Date.now()
  const baseEntry = {
    method: String(requestParams.method || 'GET').toUpperCase(),
    interface: sanitizeRequestInterface(requestParams.url),
  }

  return chain.proceed(requestParams).then(
    (response) => {
      printRequestLog({
        ...baseEntry,
        status: responseStatus(response),
        durationMs: Date.now() - startedAt,
      })
      return response
    },
    (error) => {
      printRequestLog({
        ...baseEntry,
        status: 'NETWORK_ERROR',
        durationMs: Date.now() - startedAt,
      })
      throw error
    },
  )
}

export const installRequestLogging = () => {
  if (installed) return
  Taro.addInterceptor(requestLoggingInterceptor)
  installed = true
}
