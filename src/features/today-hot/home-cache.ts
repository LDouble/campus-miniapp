import type { TodayHotEntry } from './repository'
import { getMiniappRuntimeConfig, getSelectedCampus } from '../runtime-config'
import { getPageCacheScope, readPageCache, writePageCache } from '../../state/page-cache'

export type TodayHotHomeSnapshot = {
  enabled: boolean
  items: TodayHotEntry[]
  snapshotId: number | null
  intervalSeconds: number
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
)
const isPositiveInteger = (value: unknown): value is number => (
  Number.isSafeInteger(value) && (value as number) > 0
)

// 首页只读取帖子 ID、摘要和图片数量；缓存仍需先校验这些渲染所依赖的字段。
export const isTodayHotEntry = (value: unknown): value is TodayHotEntry => (
  isRecord(value)
  && Number.isSafeInteger(value.post_id)
  && (typeof value.content === 'string' || value.content == null)
  && Array.isArray(value.images)
)

export const emptyTodayHotHomeSnapshot = (): TodayHotHomeSnapshot => ({
  enabled: false,
  items: [],
  snapshotId: null,
  intervalSeconds: 5,
})

const isTodayHotHomeSnapshot = (value: unknown): value is TodayHotHomeSnapshot => (
  isRecord(value)
  && typeof value.enabled === 'boolean'
  && Array.isArray(value.items)
  && value.items.length <= 30
  && value.items.every(isTodayHotEntry)
  && (value.snapshotId === null || isPositiveInteger(value.snapshotId))
  && typeof value.intervalSeconds === 'number'
  && Number.isFinite(value.intervalSeconds)
  && value.intervalSeconds > 0
)

export const todayHotHomeCacheKey = () => {
  const campus = getSelectedCampus(getMiniappRuntimeConfig()) || 'all'
  return `${getPageCacheScope()}:today-hot:home:${campus}`
}

export const readTodayHotHomeSnapshot = (key = todayHotHomeCacheKey()) => (
  readPageCache(key, isTodayHotHomeSnapshot) || emptyTodayHotHomeSnapshot()
)

export const writeTodayHotHomeSnapshot = (key: string, snapshot: TodayHotHomeSnapshot) => {
  // 请求归来时身份或校区已变化，绝不能污染新的页面作用域。
  if (key !== todayHotHomeCacheKey() || !isTodayHotHomeSnapshot(snapshot)) return
  writePageCache(key, snapshot)
}
