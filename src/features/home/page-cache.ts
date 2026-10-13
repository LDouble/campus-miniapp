import { apiDateTimeCampusParts } from '../../utils/date-time'
import type { HomeFeedItemView, DailyCheckinStatus, CalendarReminderView } from '../../api/types'
import type { OfficialNotice } from '../official-notices/types'
import { getPageCacheScope, readPageCache, writePageCache } from '../../state/page-cache'
import { getMiniappRuntimeConfig, getSelectedCampus } from '../runtime-config'

export type HomeSnapshot = {
  feed?: { items: HomeFeedItemView[]; page: number; total: number }
  notices?: OfficialNotice[]
  reminders?: CalendarReminderView[]
  checkin?: DailyCheckinStatus
}
const record = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown) => typeof value === 'string'
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
const list = (value: unknown, item: (value: unknown) => boolean) => Array.isArray(value) && value.every(item)
const segments = (value: unknown) => value == null || list(value, (item) => record(item) && text(item.type) && text(item.text))
const feedItem = (value: unknown) => record(value)
  && ['campus_circle_post', 'marketplace_listing', 'errand', 'carpool'].includes(value.source_type)
  && number(value.source_id) && number(value.version) && text(value.author_nickname)
  && number(value.author_id) && typeof value.author_deleted === 'boolean'
  && typeof value.liked === 'boolean' && number(value.like_count) && number(value.comment_count)
  && text(value.feed_time) && (value.content == null || text(value.content))
  && list(value.images, (image) => record(image) && text(image.url))
  && list(value.liked_by_nicknames, text) && segments(value.content_segments)
  && list(value.comment_previews, (comment) => record(comment) && number(comment.id)
    && number(comment.author_id) && number(comment.root_id)
    && text(comment.content) && text(comment.author_nickname) && segments(comment.content_segments))
const isSnapshot = (value: unknown): value is HomeSnapshot => record(value)
  && (value.feed === undefined || (record(value.feed) && list(value.feed.items, feedItem)
    && Number.isInteger(value.feed.page) && value.feed.page > 0 && number(value.feed.total)))
  && (value.notices === undefined || list(value.notices, (item) => record(item)
    && number(item.id) && text(item.title) && text(item.source) && text(item.published_at)))
  && (value.reminders === undefined || list(value.reminders, (item) => record(item)
    && number(item.id) && text(item.event_id)))
  && (value.checkin === undefined || (record(value.checkin) && text(value.checkin.server_date)
    && typeof value.checkin.checked_in === 'boolean' && typeof value.checkin.enabled === 'boolean'
    && number(value.checkin.consecutive_days) && record(value.checkin.user_level)))

export const homeCacheKey = () => `${getPageCacheScope()}:home:${getSelectedCampus(getMiniappRuntimeConfig())}`
export const readHomeSnapshot = (key = homeCacheKey()): HomeSnapshot => {
  const snapshot = readPageCache(key, isSnapshot) || {}
  const parts = apiDateTimeCampusParts(new Date().toISOString())
  const today = parts ? `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}` : ''
  // 昨日签到结果不能当作今日状态；其他缓存仍可离线展示。
  return snapshot.checkin && snapshot.checkin.server_date !== today
    ? { ...snapshot, checkin: undefined } : snapshot
}
export const updateHomeSnapshot = (key: string, value: Partial<HomeSnapshot>) => {
  if (key !== homeCacheKey()) return
  writePageCache(key, { ...readHomeSnapshot(key), ...value })
}

/** 每个区块独立完成；授权、配置或其他区块悬挂不能阻挡已完成的数据。 */
export const refreshHomeSection = async <T,>(
  loader: () => Promise<T>,
  apply: (value: T) => void,
  isCurrent: () => boolean,
  failed: () => void = () => undefined,
) => {
  try {
    const value = await loader()
    if (isCurrent()) apply(value)
  } catch {
    if (isCurrent()) failed()
  }
}
