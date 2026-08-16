import type { AcademicCacheMetadata } from '../../../api/types'
import { apiDateTimeCampusParts, apiDateTimeTimestamp } from '../../../utils/date-time'

export type AcademicCacheNoticeState =
  | {
    kind: 'fresh' | 'updated'
    message: string
    refreshAt?: number
  }
  | {
    kind: 'stale' | 'local'
    message: string
  }

const MIN_LOCAL_TIMESTAMP = Date.parse('2020-01-01T00:00:00+08:00')
const MAX_FUTURE_DRIFT_MS = 5 * 60 * 1000

const normalizeLocalTimestamp = (timestamp: number, now: number) => {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return 0
  const normalized = timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp
  if (
    normalized < MIN_LOCAL_TIMESTAMP
    || normalized > now + MAX_FUTURE_DRIFT_MS
  ) return 0
  return normalized
}

const formatTime = (timestamp: number) => {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return ''
  const parts = apiDateTimeCampusParts(new Date(timestamp).toISOString())
  if (!parts) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(parts.month)}/${pad(parts.day)} ${parts.time}`
}

const parseTimestamp = (value?: string) => {
  return apiDateTimeTimestamp(value)
}

interface ResolveAcademicCacheNoticeOptions {
  cache?: AcademicCacheMetadata | null
  updatedAt?: number
  localUpdatedAt?: number
  localFallback?: boolean
  now?: number
}

export const resolveAcademicCacheNotice = ({
  cache,
  updatedAt = 0,
  localUpdatedAt = 0,
  localFallback = false,
  now = Date.now(),
}: ResolveAcademicCacheNoticeOptions): AcademicCacheNoticeState | null => {
  if (cache?.state === 'fresh') {
    const cachedAt = formatTime(parseTimestamp(cache.cached_at))
    if (!cachedAt) return null
    const freshUntil = parseTimestamp(cache.fresh_until)
    if (freshUntil > now) {
      const refreshAt = formatTime(freshUntil)
      return {
        kind: 'fresh',
        message: refreshAt
          ? `数据缓存于 ${cachedAt}，${refreshAt} 后可下拉刷新`
          : `数据缓存于 ${cachedAt}`,
        refreshAt: freshUntil,
      }
    }
    return {
      kind: 'fresh',
      message: `数据缓存于 ${cachedAt}，现可下拉刷新`,
    }
  }

  if (cache?.state === 'stale') {
    const cachedAt = formatTime(parseTimestamp(cache.cached_at))
    if (!cachedAt) return null
    return {
      kind: 'stale',
      message: `数据缓存于 ${cachedAt}，当前为兜底数据，下拉重试`,
    }
  }

  if (localFallback) {
    const localTime = formatTime(normalizeLocalTimestamp(localUpdatedAt, now))
    if (!localTime) return null
    return {
      kind: 'local',
      message: `教务暂不可用，展示本机保存于 ${localTime} 的数据，下拉重试`,
    }
  }

  const updateTime = formatTime(normalizeLocalTimestamp(updatedAt, now))
  return updateTime
    ? { kind: 'updated', message: `更新时间：${updateTime}` }
    : null
}
