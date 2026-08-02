import {
  CookiePersistence,
  CookieStorageScope,
  CookieStorageSnapshot,
  StoredCookie,
} from './cookie-storage'
import { parseHttpUrl } from './url'
import { SessionError } from './types'

const COOKIE_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/
const MAX_COOKIE_TIME = 8.64e15
const DEFAULT_SESSION_TTL_MS = 15 * 60 * 1000

interface CookieJarOptions {
  scope: CookieStorageScope
  persistence?: CookiePersistence
  sessionTtlMs?: number
  now?: () => number
}

const defaultCookiePath = (pathname: string) => {
  if (!pathname.startsWith('/') || pathname === '/') return '/'
  const lastSlash = pathname.lastIndexOf('/')
  return lastSlash <= 0 ? '/' : pathname.slice(0, lastSlash)
}

const domainMatches = (hostname: string, domain: string) => (
  hostname === domain || hostname.endsWith(`.${domain}`)
)

const pathMatches = (pathname: string, cookiePath: string) => (
  pathname === cookiePath
  || (
    pathname.startsWith(cookiePath)
    && (cookiePath.endsWith('/') || pathname.charAt(cookiePath.length) === '/')
  )
)

const cookieIdentity = (cookie: Pick<StoredCookie, 'name' | 'domain' | 'path'>) => (
  `${cookie.name}\u0000${cookie.domain}\u0000${cookie.path}`
)

const parseMaxAge = (value: string) => {
  if (!/^-?\d+$/.test(value.trim())) return null
  const seconds = Number(value)
  return Number.isSafeInteger(seconds) ? seconds : null
}

const safeExpiresAt = (value: string) => {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return null
  return Math.min(parsed, MAX_COOKIE_TIME)
}

export const splitSetCookieHeader = (value: string) => {
  const result: string[] = []
  let start = 0
  let quoted = false
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]
    if (character === '"' && value[index - 1] !== '\\') quoted = !quoted
    if (character !== ',' || quoted) continue
    const remainder = value.slice(index + 1)
    if (!/^\s*[!#$%&'*+\-.^_`|~0-9A-Za-z]+\s*=/.test(remainder)) continue
    const item = value.slice(start, index).trim()
    if (item) result.push(item)
    start = index + 1
  }
  const finalItem = value.slice(start).trim()
  if (finalItem) result.push(finalItem)
  return result
}

const parseSetCookie = (
  rawValue: string,
  requestUrl: string,
  now: number,
): StoredCookie | null => {
  const url = parseHttpUrl(requestUrl)
  const parts = rawValue.split(';')
  const pair = parts.shift()?.trim() || ''
  const separator = pair.indexOf('=')
  if (separator <= 0) return null
  const name = pair.slice(0, separator).trim()
  const value = pair.slice(separator + 1).trim()
  if (
    !COOKIE_NAME_PATTERN.test(name)
    || /[\u0000-\u001f\u007f]/.test(value)
  ) return null

  let domain = url.hostname
  let hostOnly = true
  let path = defaultCookiePath(url.pathname)
  let secure = false
  let httpOnly = false
  let sameSite: StoredCookie['sameSite'] = ''
  let expiresAt: number | null = null
  let maxAge: number | null = null
  let rejected = false

  parts.forEach((rawAttribute) => {
    if (rejected) return
    const attribute = rawAttribute.trim()
    if (!attribute) return
    const attributeSeparator = attribute.indexOf('=')
    const rawName = attributeSeparator >= 0
      ? attribute.slice(0, attributeSeparator)
      : attribute
    const rawAttributeValue = attributeSeparator >= 0
      ? attribute.slice(attributeSeparator + 1)
      : ''
    const attributeName = rawName.trim().toLowerCase()
    const attributeValue = rawAttributeValue.trim()
    switch (attributeName) {
      case 'domain': {
        const candidate = attributeValue.replace(/^\.+/, '').toLowerCase()
        if (
          !candidate
          || candidate.split('.').length < 3
          || !domainMatches(url.hostname, candidate)
        ) {
          rejected = true
          return
        }
        domain = candidate
        hostOnly = false
        break
      }
      case 'path':
        if (attributeValue.startsWith('/')) path = attributeValue
        break
      case 'secure':
        secure = true
        break
      case 'httponly':
        httpOnly = true
        break
      case 'samesite': {
        const candidate = attributeValue.toLowerCase()
        if (candidate === 'strict' || candidate === 'lax' || candidate === 'none') {
          sameSite = candidate
        }
        break
      }
      case 'max-age':
        maxAge = parseMaxAge(attributeValue)
        break
      case 'expires':
        expiresAt = safeExpiresAt(attributeValue)
        break
      default:
        break
    }
  })

  if (rejected) return null
  if (!hostOnly && !domainMatches(url.hostname, domain)) return null
  if (maxAge !== null) {
    expiresAt = maxAge <= 0
      ? 0
      : Math.min(now + maxAge * 1000, MAX_COOKIE_TIME)
  }
  return {
    name,
    value,
    domain,
    path,
    hostOnly,
    secure,
    httpOnly,
    sameSite,
    expiresAt,
    createdAt: now,
    lastAccessedAt: now,
  }
}

export class CookieJar {
  private readonly scope: CookieStorageScope

  private readonly persistence?: CookiePersistence

  private readonly now: () => number

  private readonly sessionTtlMs: number

  private cookies: StoredCookie[] = []

  private sessionStartedAt: number

  private sessionExpiresAt: number

  constructor(options: CookieJarOptions) {
    this.scope = { ...options.scope }
    this.persistence = options.persistence
    this.now = options.now || Date.now
    this.sessionTtlMs = options.sessionTtlMs || DEFAULT_SESSION_TTL_MS
    if (
      !Number.isFinite(this.sessionTtlMs)
      || this.sessionTtlMs <= 0
      || this.sessionTtlMs > 60 * 60 * 1000
    ) {
      throw new Error('cookie session TTL is invalid')
    }
    const now = this.now()
    this.sessionStartedAt = now
    this.sessionExpiresAt = now + this.sessionTtlMs
    this.restore()
  }

  private restore = () => {
    if (!this.persistence) return
    try {
      const snapshot = this.persistence.load()
      if (!snapshot) return
      const now = this.now()
      if (snapshot.sessionExpiresAt <= now) {
        this.persistence.clear()
        return
      }
      this.sessionStartedAt = snapshot.sessionStartedAt
      this.sessionExpiresAt = snapshot.sessionExpiresAt
      this.cookies = snapshot.cookies.filter((cookie) => (
        cookie.expiresAt === null || cookie.expiresAt > now
      ))
      if (this.cookies.length !== snapshot.cookies.length) this.persist()
    } catch {
      throw new SessionError('storage_error', '教务会话读取失败')
    }
  }

  private renewIfExpired = () => {
    const now = this.now()
    if (this.sessionExpiresAt > now) return false
    this.cookies = []
    this.sessionStartedAt = now
    this.sessionExpiresAt = now + this.sessionTtlMs
    try {
      this.persistence?.clear()
    } catch {
      throw new SessionError('storage_error', '教务会话清理失败')
    }
    return true
  }

  private purgeExpired = () => {
    this.renewIfExpired()
    const now = this.now()
    const cookies = this.cookies.filter((cookie) => (
      cookie.expiresAt === null || cookie.expiresAt > now
    ))
    const changed = cookies.length !== this.cookies.length
    this.cookies = cookies
    return changed
  }

  private snapshot = (): CookieStorageSnapshot => ({
    version: 1,
    scope: { ...this.scope },
    sessionStartedAt: this.sessionStartedAt,
    sessionExpiresAt: this.sessionExpiresAt,
    savedAt: this.now(),
    cookies: this.cookies.map((cookie) => ({ ...cookie })),
  })

  persist = () => {
    if (!this.persistence) return
    try {
      this.persistence.save(this.snapshot())
    } catch {
      throw new SessionError('storage_error', '教务会话保存失败')
    }
  }

  setCookies = (rawValues: string[], requestUrl: string) => {
    this.renewIfExpired()
    const now = this.now()
    const flattened = rawValues.flatMap(splitSetCookieHeader)
    let changed = this.purgeExpired()
    flattened.forEach((rawValue) => {
      const parsed = parseSetCookie(rawValue, requestUrl, now)
      if (!parsed) return
      const identity = cookieIdentity(parsed)
      const index = this.cookies.findIndex((cookie) => cookieIdentity(cookie) === identity)
      if (parsed.expiresAt !== null && parsed.expiresAt <= now) {
        if (index >= 0) {
          this.cookies.splice(index, 1)
          changed = true
        }
        return
      }
      if (index >= 0) {
        parsed.createdAt = this.cookies[index].createdAt
        this.cookies[index] = parsed
      } else {
        this.cookies.push(parsed)
      }
      changed = true
    })
    if (changed) this.persist()
  }

  getCookieHeader = (requestUrl: string) => {
    const expired = this.purgeExpired()
    const url = parseHttpUrl(requestUrl)
    const now = this.now()
    const selected = this.cookies
      .filter((cookie) => (
        (cookie.hostOnly ? cookie.domain === url.hostname : domainMatches(url.hostname, cookie.domain))
        && pathMatches(url.pathname, cookie.path)
        && (!cookie.secure || url.scheme === 'https')
      ))
      .sort((left, right) => (
        right.path.length - left.path.length
        || left.createdAt - right.createdAt
      ))
    selected.forEach((cookie) => {
      cookie.lastAccessedAt = now
    })
    if (expired || selected.length) this.persist()
    return selected.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ')
  }

  clear = () => {
    const now = this.now()
    this.cookies = []
    this.sessionStartedAt = now
    this.sessionExpiresAt = now + this.sessionTtlMs
    try {
      this.persistence?.clear()
    } catch {
      throw new SessionError('storage_error', '教务会话清理失败')
    }
  }

  size = () => {
    if (this.purgeExpired()) this.persist()
    return this.cookies.length
  }
}
