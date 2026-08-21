import { apiDateTimeCampusParts, apiDateTimeTimestamp } from '../../utils/date-time'

const CAMPUS_OFFSET_MILLISECONDS = 8 * 60 * 60 * 1000
const MINUTE_MILLISECONDS = 60 * 1000
const HOUR_MILLISECONDS = 60 * MINUTE_MILLISECONDS
const DAY_MILLISECONDS = 24 * HOUR_MILLISECONDS
const RELATIVE_DAY_LIMIT = 7
const MESSAGE_TIME_GROUP_GAP_MILLISECONDS = 5 * MINUTE_MILLISECONDS
const CAMPUS_WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const formatConcreteDate = (value: string, now: number) => {
  const parts = apiDateTimeCampusParts(value)
  const currentParts = apiDateTimeCampusParts(new Date(now).toISOString())
  if (!parts || !currentParts) return '时间待确认'

  return parts.year === currentParts.year
    ? `${parts.month}月${parts.day}日`
    : `${parts.year}年${parts.month}月${parts.day}日`
}

/**
 * 消息列表使用的紧凑时间：刚刚、分钟、小时、昨天、近几天，最后回退到具体日期。
 * 自然日以校园时区（UTC+8）为准，不使用设备本地时区的日期边界。
 */
export const formatMessageListTime = (value?: string | null, now = Date.now()) => {
  if (!value) return '时间待确认'

  const timestamp = apiDateTimeTimestamp(value)
  if (!Number.isFinite(timestamp)) return '时间待确认'
  if (timestamp > now) return formatConcreteDate(value, now)

  const elapsed = now - timestamp
  const dayIndex = Math.floor((timestamp + CAMPUS_OFFSET_MILLISECONDS) / DAY_MILLISECONDS)
  const currentDayIndex = Math.floor((now + CAMPUS_OFFSET_MILLISECONDS) / DAY_MILLISECONDS)
  const dayDifference = currentDayIndex - dayIndex

  if (dayDifference === 0) {
    if (elapsed < MINUTE_MILLISECONDS) return '刚刚'
    if (elapsed < HOUR_MILLISECONDS) return `${Math.floor(elapsed / MINUTE_MILLISECONDS)}分钟前`
    return `${Math.floor(elapsed / HOUR_MILLISECONDS)}小时前`
  }

  if (dayDifference === 1) return '昨天'
  if (dayDifference > 1 && dayDifference < RELATIVE_DAY_LIMIT) {
    return `${dayDifference}天前`
  }

  return formatConcreteDate(value, now)
}

const campusDayIndex = (timestamp: number) => (
  Math.floor((timestamp + CAMPUS_OFFSET_MILLISECONDS) / DAY_MILLISECONDS)
)

/** 聊天详情的时间分隔条，保留校园时区下的星期和具体时刻。 */
export const formatMessageTimelineTime = (value?: string | null) => {
  const timestamp = apiDateTimeTimestamp(value)
  const parts = apiDateTimeCampusParts(value)
  if (!Number.isFinite(timestamp) || !parts) return '时间待确认'

  const campusDate = new Date(timestamp + CAMPUS_OFFSET_MILLISECONDS)
  const weekday = CAMPUS_WEEKDAYS[campusDate.getUTCDay()]
  return `${weekday} ${parts.time}`
}

/** 相邻消息间隔较大或跨自然日时，才显示下一条时间分隔条。 */
export const shouldShowMessageTimelineTime = (
  value?: string | null,
  previousValue?: string | null,
) => {
  if (!previousValue) return true
  const timestamp = apiDateTimeTimestamp(value)
  const previousTimestamp = apiDateTimeTimestamp(previousValue)
  if (!Number.isFinite(timestamp) || !Number.isFinite(previousTimestamp)) return true
  return timestamp - previousTimestamp >= MESSAGE_TIME_GROUP_GAP_MILLISECONDS
    || campusDayIndex(timestamp) !== campusDayIndex(previousTimestamp)
}
