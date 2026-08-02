import { CookieJar } from './cookie-jar'
import { firstHeader, headerValues, normalizeHeaders } from './headers'
import {
  HttpMethod,
  HttpTransport,
  SessionError,
  SessionRequest,
  SessionResponse,
} from './types'
import {
  parseHttpUrl,
  resolveHttpUrl,
  stripHash,
} from './url'

const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308])
const BODY_HEADERS = new Set(['content-length', 'content-type', 'transfer-encoding'])
const DEFAULT_TIMEOUT_MS = 15000
const DEFAULT_MAX_REDIRECTS = 10
const DEFAULT_MAX_RESPONSE_BYTES = 2 * 1024 * 1024

interface HttpSessionOptions {
  jar: CookieJar
  transport: HttpTransport
  defaultHeaders?: Record<string, string>
  allowedHosts: string[]
  timeout?: number
  maxRedirects?: number
  maxResponseBytes?: number
}

const utf8ByteLength = (value: string) => {
  let length = 0
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code < 0x80) length += 1
    else if (code < 0x800) length += 2
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1)
      if (next >= 0xdc00 && next <= 0xdfff) {
        length += 4
        index += 1
      } else length += 3
    } else length += 3
  }
  return length
}

const redirectMethod = (statusCode: number, method: HttpMethod) => {
  if (statusCode === 303 && method !== 'HEAD') return 'GET'
  if ((statusCode === 301 || statusCode === 302) && method !== 'GET' && method !== 'HEAD') {
    return 'GET'
  }
  return method
}

const withoutBodyHeaders = (headers: Record<string, string>) => (
  Object.fromEntries(Object.entries(headers).filter(([name]) => (
    !BODY_HEADERS.has(name.toLowerCase())
  )))
)

const rewriteLegacyGraduateRedirect = (value: string) => {
  const parsed = parseHttpUrl(value)
  if (
    parsed.scheme !== 'http'
    || parsed.hostname !== 'id.ouc.edu.cn'
    || parsed.port !== '8071'
    || parsed.pathname !== '/sso/login'
  ) return value
  const serviceMatch = /(?:^|&)service=([^&]*)/.exec(parsed.search.replace(/^\?/, ''))
  if (!serviceMatch) throw new SessionError('blocked_redirect', '教务跳转地址不安全')
  let service = ''
  try {
    service = decodeURIComponent(serviceMatch[1].replace(/\+/g, ' '))
  } catch {
    throw new SessionError('blocked_redirect', '教务跳转地址不安全')
  }
  const serviceUrl = parseHttpUrl(service)
  if (
    serviceUrl.scheme !== 'https'
    || !['jwgl2024.ouc.edu.cn', 'pgs.ouc.edu.cn', 'my.ouc.edu.cn'].includes(serviceUrl.hostname)
  ) {
    throw new SessionError('blocked_redirect', '教务跳转地址不安全')
  }
  return `https://id.ouc.edu.cn${parsed.pathname}${parsed.search}`
}

export class HttpSession {
  private readonly jar: CookieJar

  private readonly transport: HttpTransport

  private readonly defaultHeaders: Record<string, string>

  private readonly allowedHosts: Set<string>

  private readonly timeout: number

  private readonly maxRedirects: number

  private readonly maxResponseBytes: number

  constructor(options: HttpSessionOptions) {
    this.jar = options.jar
    this.transport = options.transport
    this.defaultHeaders = { ...(options.defaultHeaders || {}) }
    this.allowedHosts = new Set(options.allowedHosts.map((host) => host.toLowerCase()))
    this.timeout = options.timeout || DEFAULT_TIMEOUT_MS
    this.maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS
    this.maxResponseBytes = options.maxResponseBytes || DEFAULT_MAX_RESPONSE_BYTES
  }

  private validateUrl = (value: string) => {
    let parsed: ReturnType<typeof parseHttpUrl>
    try {
      parsed = parseHttpUrl(value)
    } catch {
      throw new SessionError('invalid_url', '教务请求地址无效')
    }
    if (parsed.scheme !== 'https' || parsed.port) {
      throw new SessionError('blocked_redirect', '教务请求只允许标准 HTTPS 地址')
    }
    if (!this.allowedHosts.has(parsed.hostname)) {
      throw new SessionError('blocked_redirect', '教务请求目标不在白名单')
    }
    return stripHash(parsed.href)
  }

  request = async (options: SessionRequest): Promise<SessionResponse> => {
    let url = this.validateUrl(options.url)
    let method = options.method || 'GET'
    let body = options.body
    let headers = {
      ...this.defaultHeaders,
      ...(options.headers || {}),
    }
    const history: SessionResponse['history'] = []
    const visited = new Set<string>()

    for (let redirectCount = 0; redirectCount <= this.maxRedirects; redirectCount += 1) {
      const visitKey = `${method} ${url}`
      if (visited.has(visitKey)) {
        throw new SessionError('redirect_loop', '教务请求出现循环跳转')
      }
      visited.add(visitKey)

      const cookieHeader = this.jar.getCookieHeader(url)
      const requestHeaders = withoutBodyHeaders(
        Object.fromEntries(Object.entries(headers).filter(([name]) => (
          name.toLowerCase() !== 'cookie'
        ))),
      )
      if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
        Object.entries(headers).forEach(([name, value]) => {
          if (BODY_HEADERS.has(name.toLowerCase())) requestHeaders[name] = value
        })
      }
      // 微信基础库对手工 Cookie 请求头的键名存在大小写兼容差异：
      // 使用小写 `cookie` 才能确保开发者工具和真机都按预期透传。
      if (cookieHeader) requestHeaders.cookie = cookieHeader

      console.log('[academic-http] request', {
        method,
        url,
        cookieNames: cookieHeader
          ? cookieHeader.split(';').map((item) => item.split('=', 1)[0].trim())
          : [],
      })
      const response = await this.transport.send({
        url,
        method,
        headers: requestHeaders,
        body: method === 'GET' || method === 'HEAD' ? undefined : body,
        timeout: options.timeout || this.timeout,
      })
      if (utf8ByteLength(response.data) > this.maxResponseBytes) {
        throw new SessionError('response_too_large', '教务响应超过大小限制')
      }
      const responseHeaders = normalizeHeaders(response.headers)

      const responseCookies = [
        ...response.cookies,
        ...headerValues(responseHeaders, 'set-cookie'),
      ]
      this.jar.setCookies([...new Set(responseCookies)], url)

      const location = firstHeader(responseHeaders, 'location')
      console.log('[academic-http] response', {
        url,
        statusCode: response.statusCode,
        location: location || '',
      })
      if (!REDIRECT_STATUS.has(response.statusCode) || !location) {
        return { ...response, headers: responseHeaders, url, history }
      }
      if (redirectCount >= this.maxRedirects) {
        throw new SessionError('too_many_redirects', '教务请求跳转次数过多')
      }

      let target: string
      try {
        target = resolveHttpUrl(url, location)
        target = rewriteLegacyGraduateRedirect(target)
      } catch (error) {
        if (error instanceof SessionError) throw error
        throw new SessionError('invalid_url', '教务跳转地址无效')
      }
      target = this.validateUrl(target)
      history.push({
        url,
        method,
        statusCode: response.statusCode,
        location: target,
      })
      const nextMethod = redirectMethod(response.statusCode, method)
      if (nextMethod !== method) {
        body = undefined
        headers = withoutBodyHeaders(headers)
      }
      console.log('[academic-http] redirect', {
        statusCode: response.statusCode,
        from: url,
        to: target,
        method: `${method} -> ${nextMethod}`,
      })
      method = nextMethod
      url = target
    }
    throw new SessionError('too_many_redirects', '教务请求跳转次数过多')
  }

  get = (url: string, options: Omit<SessionRequest, 'url' | 'method'> = {}) => (
    this.request({ ...options, url, method: 'GET' })
  )

  post = (
    url: string,
    body: SessionRequest['body'],
    options: Omit<SessionRequest, 'url' | 'method' | 'body'> = {},
  ) => this.request({ ...options, url, body, method: 'POST' })

  clearCookies = () => this.jar.clear()
}
