import type { CampusCircleSectionView } from '../../api/types'
import { formatDateTime } from '../life-services/format'
import { apiDateTimeTimestamp } from '../../utils/date-time'

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const RELATIVE_DAY_LIMIT = 30

export const homeMomentsBusinessLabels = {
  marketplace: '二手',
  errand: '跑腿',
  carpool: '找同行',
} as const

export const formatHomeMomentsTime = (
  value?: string | null,
  now = Date.now(),
) => {
  if (!value) return '时间待确认'
  const timestamp = apiDateTimeTimestamp(value)
  if (Number.isNaN(timestamp) || timestamp > now) return formatDateTime(value)

  const elapsed = now - timestamp
  if (elapsed < MINUTE_MS) return '刚刚'

  const minutes = Math.floor(elapsed / MINUTE_MS)
  if (minutes < 60) return `${minutes}分钟前`

  const hours = Math.floor(elapsed / HOUR_MS)
  if (hours < 24) return `${hours}小时前`

  const days = Math.floor(elapsed / DAY_MS)
  return days <= RELATIVE_DAY_LIMIT ? `${days}天` : formatDateTime(value)
}

export const flattenCommunitySections = (
  items: CampusCircleSectionView[],
): CampusCircleSectionView[] => (
  items.flatMap((item) => [item, ...flattenCommunitySections(item.children || [])])
)

export const communitySectionNamesById = (
  items: CampusCircleSectionView[],
) => Object.fromEntries(
  flattenCommunitySections(items).map((item) => [item.id, item.name]),
) as Record<number, string>
