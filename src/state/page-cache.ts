import Taro from '@tarojs/taro'
import { resolveApiBaseUrl } from '../api/environment'
import { invalidateSharedResourceGroup } from './shared-resource'
import { subscribeLifeHubMutation } from '../features/life-services/refresh-policy'

// 只用于展示缓存，绝不作为服务端授权或写操作的依据。
export type CachedPageUser = { id: number; username: string; avatar_url: string }
type PageSession = { version: 1; generation: number; user: CachedPageUser | null }
type Entry = { key: string; updatedAt: number; value: unknown }
const environment = (() => {
  let version = 'develop'
  try { version = Taro.getAccountInfoSync().miniProgram.envVersion } catch { /* 使用与请求层一致的开发环境 */ }
  return resolveApiBaseUrl(version, {
    review: __CAMPUS_REVIEW_API_BASE_URL__,
    production: __CAMPUS_PRODUCTION_API_BASE_URL__,
  })
})()
const SESSION_KEY = `campus.pageSession.v1:${environment}`
const CACHE_KEY = `campus.pageCache.v1:${environment}`
const listeners = new Set<() => void>()
const isUser = (value: unknown): value is CachedPageUser => {
  if (!value || typeof value !== 'object') return false
  const user = value as CachedPageUser
  return Number.isSafeInteger(user.id) && user.id > 0
    && typeof user.username === 'string' && typeof user.avatar_url === 'string'
}
const readSession = (): PageSession => {
  try {
    const value = Taro.getStorageSync<PageSession>(SESSION_KEY)
    if (value?.version === 1 && Number.isSafeInteger(value.generation)
      && (value.user === null || isUser(value.user))) return value
  } catch { /* 存储故障不能阻断渲染 */ }
  return { version: 1, generation: 0, user: null }
}
let session = readSession()
const persistSession = () => {
  try { Taro.setStorageSync(SESSION_KEY, session) } catch {
    // 写入新身份失败时不能让下次启动读回旧账号。
    try { Taro.removeStorageSync(SESSION_KEY) } catch { /* 本次运行仍使用内存身份 */ }
  }
}
export const getCachedPageUser = () => session.user
export const getCachedPageUserId = () => session.user?.id || 0
export const getPageSessionGeneration = () => session.generation
export const getPageCacheScope = () => `${environment}:${session.generation}:${getCachedPageUserId()}`
export const subscribePageCacheScope = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
const notify = () => listeners.forEach((listener) => {
  try { listener() } catch { /* 单个页面卸载异常不能阻断会话隔离 */ }
})
export const saveCachedPageUser = (
  user: { id: number; username?: string; avatar_url?: string | null },
  generation = session.generation,
) => {
  if (generation !== session.generation || !Number.isSafeInteger(user.id) || user.id <= 0) return
  const previousUserId = getCachedPageUserId()
  const changed = previousUserId !== user.id
  if (previousUserId && changed) {
    session = { ...session, generation: session.generation + 1 }
    invalidateSharedResourceGroup('session')
    invalidateSharedResourceGroup('academic')
    invalidateSharedResourceGroup('verification')
  }
  session = { ...session, user: {
    id: user.id,
    username: user.username ?? (changed ? '' : session.user?.username || ''),
    avatar_url: user.avatar_url !== undefined ? user.avatar_url || '' : (changed ? '' : session.user?.avatar_url || ''),
  } }
  persistSession()
  if (changed) notify()
}
export const clearPageSession = () => {
  session = { version: 1, generation: session.generation + 1, user: null }
  persistSession()
  // 删除展示快照，账号重新登录后必须重新取数。
  try { Taro.removeStorageSync(CACHE_KEY) } catch { /* scope 已更换，旧记录不可达 */ }
  notify()
}
const entries = (): Entry[] => {
  try {
    const stored = Taro.getStorageSync<{ version: number; entries: Entry[] }>(CACHE_KEY)
    if (stored?.version === 1 && Array.isArray(stored.entries)) {
      return stored.entries.filter((entry) => entry && typeof entry.key === 'string'
        && Number.isFinite(entry.updatedAt)).slice(-32)
    }
  } catch { /* 损坏缓存按未命中处理 */ }
  return []
}
export const readPageCache = <T,>(key: string, validate: (value: unknown) => value is T): T | null => {
  if (!getCachedPageUserId() || !key.startsWith(`${getPageCacheScope()}:`)) return null
  try {
    const entry = entries().find((item) => item.key === key)
    return entry && validate(entry.value) ? entry.value : null
  } catch { return null }
}
export const writePageCache = <T,>(key: string, value: T) => {
  if (!getCachedPageUserId() || !key.startsWith(`${getPageCacheScope()}:`)) return
  try {
    // 有界存储；拒绝超大快照，保留其他页面缓存。
    const entry = { key, value, updatedAt: Date.now() }
    if (JSON.stringify(entry).length > 160_000) return
    const next = [...entries().filter((item) => item.key !== key), entry].slice(-32)
    while (JSON.stringify(next).length > 700_000) next.shift()
    Taro.setStorageSync(CACHE_KEY, { version: 1, entries: next })
  } catch { /* 空间不足不能使已成功的网络结果变成失败 */ }
}
export const removePageCache = (key: string) => {
  try { Taro.setStorageSync(CACHE_KEY, { version: 1, entries: entries().filter((entry) => entry.key !== key) }) } catch { /* 尽力清理 */ }
}

/** 已知内容变更后，旧列表快照不能在下次冷启动复活被删除的内容。 */
export const invalidatePageFeedCaches = (community = false) => {
  try {
    const next = entries().flatMap((entry) => {
      if (community && entry.key.includes(':community:')
        && (entry.key.includes(':feed:') || entry.key.endsWith(':hot-topics'))) return []
      if (community && entry.key.includes(':today-hot:')) return []
      if (entry.key.includes(':home:') && entry.value && typeof entry.value === 'object') {
        const { feed: _feed, ...rest } = entry.value as Record<string, unknown>
        return [{ ...entry, value: rest }]
      }
      return [entry]
    })
    Taro.setStorageSync(CACHE_KEY, { version: 1, entries: next })
  } catch { /* 存储故障不回滚服务端已完成的操作 */ }
}

subscribeLifeHubMutation((section) => invalidatePageFeedCaches(section === 'community'))
