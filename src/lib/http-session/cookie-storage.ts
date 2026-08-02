export type AcademicCookieEducationLevel = 'undergraduate' | 'graduate'

export interface CookieStorageScope {
  platformUserId: number
  educationLevel: AcademicCookieEducationLevel
}

export interface StoredCookie {
  name: string
  value: string
  domain: string
  path: string
  hostOnly: boolean
  secure: boolean
  httpOnly: boolean
  sameSite: 'strict' | 'lax' | 'none' | ''
  expiresAt: number | null
  createdAt: number
  lastAccessedAt: number
}

export interface CookieStorageSnapshot {
  version: 1
  scope: CookieStorageScope
  sessionStartedAt: number
  sessionExpiresAt: number
  savedAt: number
  cookies: StoredCookie[]
}

export interface KeyValueStorage {
  get: (key: string) => unknown
  set: (key: string, value: unknown) => void
  remove: (key: string) => void
  keys: () => string[]
}

export interface CookiePersistence {
  load: () => CookieStorageSnapshot | null
  save: (snapshot: CookieStorageSnapshot) => void
  clear: () => void
}

const STORAGE_PREFIX = 'campus.httpSession.cookies.v1.'

const validScope = (value: unknown): value is CookieStorageScope => {
  if (!value || typeof value !== 'object') return false
  const scope = value as CookieStorageScope
  return (
    Number.isSafeInteger(scope.platformUserId)
    && scope.platformUserId > 0
    && (scope.educationLevel === 'undergraduate' || scope.educationLevel === 'graduate')
  )
}

const validStoredCookie = (value: unknown): value is StoredCookie => {
  if (!value || typeof value !== 'object') return false
  const cookie = value as StoredCookie
  return (
    typeof cookie.name === 'string'
    && !!cookie.name
    && typeof cookie.value === 'string'
    && typeof cookie.domain === 'string'
    && !!cookie.domain
    && typeof cookie.path === 'string'
    && cookie.path.startsWith('/')
    && typeof cookie.hostOnly === 'boolean'
    && typeof cookie.secure === 'boolean'
    && typeof cookie.httpOnly === 'boolean'
    && ['strict', 'lax', 'none', ''].includes(cookie.sameSite)
    && (cookie.expiresAt === null || Number.isFinite(cookie.expiresAt))
    && Number.isFinite(cookie.createdAt)
    && Number.isFinite(cookie.lastAccessedAt)
  )
}

const validSnapshot = (value: unknown): value is CookieStorageSnapshot => {
  if (!value || typeof value !== 'object') return false
  const snapshot = value as CookieStorageSnapshot
  return (
    snapshot.version === 1
    && validScope(snapshot.scope)
    && Number.isFinite(snapshot.sessionStartedAt)
    && Number.isFinite(snapshot.sessionExpiresAt)
    && Number.isFinite(snapshot.savedAt)
    && snapshot.sessionExpiresAt > snapshot.sessionStartedAt
    && Array.isArray(snapshot.cookies)
    && snapshot.cookies.every(validStoredCookie)
  )
}

const storageKey = (scope: CookieStorageScope) => (
  `${STORAGE_PREFIX}${scope.platformUserId}.${scope.educationLevel}`
)

const sameScope = (left: CookieStorageScope, right: CookieStorageScope) => (
  left.platformUserId === right.platformUserId
  && left.educationLevel === right.educationLevel
)

export class CookieStorageRepository implements CookiePersistence {
  private readonly adapter: KeyValueStorage

  private readonly scope: CookieStorageScope

  constructor(adapter: KeyValueStorage, scope: CookieStorageScope) {
    if (!validScope(scope)) throw new Error('cookie storage scope is invalid')
    this.adapter = adapter
    this.scope = { ...scope }
  }

  load = () => {
    const key = storageKey(this.scope)
    const value = this.adapter.get(key)
    if (value === undefined || value === null || value === '') return null
    if (!validSnapshot(value) || !sameScope(value.scope, this.scope)) {
      this.adapter.remove(key)
      return null
    }
    return {
      ...value,
      scope: { ...value.scope },
      cookies: value.cookies.map((cookie) => ({ ...cookie })),
    }
  }

  save = (snapshot: CookieStorageSnapshot) => {
    if (!validSnapshot(snapshot) || !sameScope(snapshot.scope, this.scope)) {
      throw new Error('cookie storage snapshot is invalid')
    }
    this.adapter.set(storageKey(this.scope), {
      ...snapshot,
      scope: { ...snapshot.scope },
      cookies: snapshot.cookies.map((cookie) => ({ ...cookie })),
    })
  }

  clear = () => {
    this.adapter.remove(storageKey(this.scope))
  }

  static clearExpired = (adapter: KeyValueStorage, now = Date.now()) => {
    adapter.keys()
      .filter((key) => key.startsWith(STORAGE_PREFIX))
      .forEach((key) => {
        const value = adapter.get(key)
        if (!validSnapshot(value) || value.sessionExpiresAt <= now) {
          adapter.remove(key)
          return
        }
        const cookies = value.cookies.filter((cookie) => (
          cookie.expiresAt === null || cookie.expiresAt > now
        ))
        if (cookies.length !== value.cookies.length) {
          adapter.set(key, { ...value, cookies, savedAt: now })
        }
      })
  }

  static clearUser = (adapter: KeyValueStorage, platformUserId: number) => {
    if (!Number.isSafeInteger(platformUserId) || platformUserId <= 0) return
    const prefix = `${STORAGE_PREFIX}${platformUserId}.`
    adapter.keys()
      .filter((key) => key.startsWith(prefix))
      .forEach((key) => adapter.remove(key))
  }

  static clearAll = (adapter: KeyValueStorage) => {
    adapter.keys()
      .filter((key) => key.startsWith(STORAGE_PREFIX))
      .forEach((key) => adapter.remove(key))
  }
}

