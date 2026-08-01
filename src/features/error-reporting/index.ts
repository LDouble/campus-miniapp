import Taro from '@tarojs/taro'
import { apiUrl } from '../../api/auth'

export type ClientErrorKind =
  | 'http_5xx'
  | 'invalid_response'
  | 'js_error'
  | 'network_error'
  | 'unhandled_rejection'

export type ClientErrorInput = {
  kind: ClientErrorKind
  message: string
  route?: string
  stack?: string
  requestId?: string
  statusCode?: number
}

const recentFingerprints = new Map<string, number>()
const duplicateWindowMs = 30_000
const maximumReportsPerSession = 50
let sentCount = 0
let reporting = false
let installed = false

const redact = (value: string, maximum: number) => value
  .replace(/bearer\s+[a-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
  .replace(/"?(authorization|access[_-]?token|refresh[_-]?token|password|openid|student[_-]?no)"?\s*[:=]\s*"?[^"\s,;}]+"?/gi, '$1=[REDACTED]')
  .replace(/\beyJ[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\b/g, '[REDACTED_JWT]')
  .trim()
  .slice(0, maximum)

const sanitizeRoute = (route: string) => redact(route.split(/[?#]/, 1)[0] || '/', 512)

const currentRoute = () => {
  const pages = Taro.getCurrentPages() as Array<{ route?: string }>
  return sanitizeRoute(pages[pages.length - 1]?.route || '/')
}

const fingerprint = (input: Required<Pick<ClientErrorInput, 'kind' | 'message' | 'route'>> & ClientErrorInput) => (
  [input.kind, input.route, input.message, input.stack || '', input.statusCode || 0].join('\u0000')
)

export const reportClientError = async (input: ClientErrorInput) => {
  if (reporting || sentCount >= maximumReportsPerSession) return
  const normalized = {
    kind: input.kind,
    message: redact(input.message || 'Unknown error', 1000),
    route: sanitizeRoute(input.route || currentRoute()),
    stack: input.stack ? redact(input.stack, 12000) : undefined,
    requestId: input.requestId ? redact(input.requestId, 36) : undefined,
    statusCode: input.statusCode,
  }
  const key = fingerprint(normalized)
  const now = Date.now()
  const lastSentAt = recentFingerprints.get(key) || 0
  if (now - lastSentAt < duplicateWindowMs) return
  recentFingerprints.set(key, now)
  sentCount += 1
  reporting = true
  try {
    await Taro.request({
      url: apiUrl('/api/v1/error-reports'),
      method: 'POST',
      data: {
        source: 'miniapp',
        release: String(__CAMPUS_APP_RELEASE__),
        kind: normalized.kind,
        route: normalized.route,
        message: normalized.message,
        ...(normalized.stack ? { stack: normalized.stack } : {}),
        ...(normalized.requestId ? { request_id: normalized.requestId } : {}),
        ...(normalized.statusCode !== undefined ? { status_code: normalized.statusCode } : {}),
      },
      header: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    })
  } catch {
    // Reporting must never disrupt the user flow or recursively report itself.
  } finally {
    reporting = false
  }
}

const errorDetails = (error: unknown) => {
  if (error instanceof Error) {
    return { message: error.message || error.name, stack: error.stack }
  }
  if (typeof error === 'string') return { message: error }
  try {
    return { message: JSON.stringify(error) }
  } catch {
    return { message: String(error) }
  }
}

export const installGlobalErrorReporting = () => {
  if (installed) return
  installed = true
  Taro.onError((error) => {
    const details = errorDetails(error)
    void reportClientError({ kind: 'js_error', ...details })
  })
  Taro.onUnhandledRejection((event) => {
    const details = errorDetails(event.reason)
    void reportClientError({ kind: 'unhandled_rejection', ...details })
  })
}
