import type { CampusCircleSectionView } from '../../api/types'
import { formatDateTime } from '../life-services/format'
import { apiDateTimeTimestamp } from '../../utils/date-time'

const DAY_MS = 24 * 60 * 60 * 1000
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

  const days = Math.max(1, Math.ceil((now - timestamp) / DAY_MS))
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
