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
