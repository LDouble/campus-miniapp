import type { AcademicCacheMetadata } from '../../../api/types'
import { apiDateTimeCampusParts, apiDateTimeTimestamp } from '../../../utils/date-time'

export type AcademicCacheNoticeState =
  | {
    kind: 'fresh'
    message: string
    refreshAt?: number
  }
  | {
    kind: 'stale' | 'local'
    message: string
  }

const formatTime = (timestamp: number) => {
  if (!Number.isFinite(timestamp)) return ''
  const parts = apiDateTimeCampusParts(new Date(timestamp).toISOString())
  if (!parts) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(parts.month)}/${pad(parts.day)} ${parts.time}`
}

const parseTimestamp = (value?: string) => {
  return apiDateTimeTimestamp(value)
}

export const resolveAcademicCacheNotice = (
  cache?: AcademicCacheMetadata | null,
  localUpdatedAt = 0,
  now = Date.now(),
  localFallback = false,
): AcademicCacheNoticeState | null => {
  if (cache?.state === 'fresh') {
    const cachedAt = formatTime(parseTimestamp(cache.cached_at))
    if (!cachedAt) return null
    const freshUntil = parseTimestamp(cache.fresh_until)
    if (freshUntil > now) {
      const refreshAt = formatTime(freshUntil)
      return {
        kind: 'fresh',
        message: refreshAt
          ? `数据缓存于 ${cachedAt}，预计 ${refreshAt} 后可更新`
          : `数据缓存于 ${cachedAt}`,
        refreshAt: freshUntil,
      }
    }
    return {
      kind: 'fresh',
      message: `数据缓存于 ${cachedAt}，现可下拉更新`,
    }
  }

  if (cache?.state === 'stale') {
    const cachedAt = formatTime(parseTimestamp(cache.cached_at))
    if (!cachedAt) return null
    return {
      kind: 'stale',
      message: `数据缓存于 ${cachedAt}，当前为兜底数据，下拉更新`,
    }
  }

  const localTime = formatTime(localUpdatedAt)
  if (!localTime) return null
  return {
    kind: 'local',
    message: localFallback
      ? `教务暂不可用，展示本机保存于 ${localTime} 的数据，下拉重试`
      : `展示本机保存于 ${localTime} 的数据，正在更新`,
  }
}
