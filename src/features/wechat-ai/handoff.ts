type AgentHandoff = {
  pageId: string
  path: string
  query: string
}

type AgentHandoffListener = (event: unknown) => void

type WechatAgentApi = {
  onAgentHandoff?: (listener: AgentHandoffListener) => void
}

const MAX_HANDOFFS = 20
const handoffs = new Map<string, AgentHandoff>()
let registered = false

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' ? value as Record<string, unknown> : null
)

const nonEmptyString = (value: unknown, maxLength = 512) => {
  if (typeof value !== 'string') return ''
  const normalized = value.trim()
  return normalized && normalized.length <= maxLength ? normalized : ''
}

const normalizePath = (path: string) => path.replace(/^\/+/, '').replace(/\?.*$/, '')

const parseAgentHandoff = (value: unknown): AgentHandoff | null => {
  const event = asRecord(value)
  if (!event) return null
  const pageId = nonEmptyString(event.pageId, 128)
  const path = nonEmptyString(event.path, 256)
  const query = typeof event.query === 'string' && event.query.length <= 2048
    ? event.query
    : ''
  return pageId && path ? { pageId, path, query } : null
}

const decodeQueryPart = (value: string) => {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '))
  } catch {
    return ''
  }
}

const parseQuery = (value: string): Record<string, string> => {
  const result: Record<string, string> = {}
  const query = value.replace(/^\?/, '')
  if (!query) return result
  for (const part of query.split('&')) {
    const [rawKey, ...rawValue] = part.split('=')
    const key = decodeQueryPart(rawKey || '')
    const parsedValue = decodeQueryPart(rawValue.join('='))
    if (!key || key.length > 64 || parsedValue.length > 512 || key in result) continue
    result[key] = parsedValue
  }
  return result
}

const routeOptions = (options: Record<string, unknown>) => Object.entries(options).reduce<Record<string, string>>(
  (result, [key, value]) => {
    if (typeof value === 'string' && key.length <= 64 && value.length <= 512) result[key] = value
    return result
  },
  {},
)

const takeAgentHandoff = (pageId: unknown) => {
  const normalizedPageId = nonEmptyString(pageId, 128)
  if (!normalizedPageId) return null
  const handoff = handoffs.get(normalizedPageId) || null
  if (handoff) handoffs.delete(normalizedPageId)
  return handoff
}

export const registerWechatAiHandoff = () => {
  if (registered) return true
  const wxApi = (globalThis as typeof globalThis & { wx?: WechatAgentApi }).wx
  if (!wxApi?.onAgentHandoff) return false
  wxApi.onAgentHandoff((event) => {
    const handoff = parseAgentHandoff(event)
    if (!handoff) return
    handoffs.delete(handoff.pageId)
    handoffs.set(handoff.pageId, handoff)
    while (handoffs.size > MAX_HANDOFFS) {
      const oldestPageId = handoffs.keys().next().value
      if (!oldestPageId) break
      handoffs.delete(oldestPageId)
    }
  })
  registered = true
  return true
}

/**
 * 优先消费微信 AI 事件中按 pageId 缓存的 query；payload 不参与页面参数决策。
 * 普通页面打开仍可使用自身 URL query，便于分享和本地调试。
 */
export const takeWechatAiHandoffQuery = (
  options: Record<string, unknown>,
  expectedPath: string,
) => {
  const directQuery = routeOptions(options)
  const handoff = takeAgentHandoff(options.pageId)
  if (!handoff || normalizePath(handoff.path) !== normalizePath(expectedPath)) return directQuery
  return { ...directQuery, ...parseQuery(handoff.query) }
}
