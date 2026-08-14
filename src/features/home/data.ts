import type { MarketplaceListingView, Notice } from '../../api/types'
import type { AcademicScheduleCache } from '../../pages/academic/storage'
import type { AcademicPeriod, Course } from '../../pages/academic/types'
import { parseDate } from '../../pages/academic/utils'
import { apiDateTimeCampusParts, apiDateTimeTimestamp } from '../../utils/date-time'
import {
  getCampusSections,
  MiniappRuntimeConfig,
} from '../runtime-config'

const monthNames = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
]

export type CoursePreviewItem = {
  course: Course
  startsAt: Date
  endsAt: Date
  status: 'ongoing' | 'upcoming'
  statusText: string
}

export type CoursePreview = {
  targetDate: Date
  dayLabel: '今天' | '明天' | '假期'
  dateLabel: string
  total: number
  items: CoursePreviewItem[]
  hiddenCount: number
  emptyText: string
  emptyHint: string
}

const startOfDay = (value: Date) => {
  const result = new Date(value)
  result.setHours(0, 0, 0, 0)
  return result
}

const offsetDay = (value: Date, offset: number) => {
  const result = startOfDay(value)
  result.setDate(result.getDate() + offset)
  return result
}

const periodDayIndex = (period: AcademicPeriod, targetDate: Date) => {
  const periodStart = startOfDay(parseDate(period.startDate))
  if (Number.isNaN(periodStart.getTime())) return -1
  return Math.round(
    (startOfDay(targetDate).getTime() - periodStart.getTime()) / 86400000,
  )
}

const resolvePeriodForDate = (
  periods: AcademicPeriod[],
  targetDate: Date,
) => periods
  .map((period) => ({ period, dayIndex: periodDayIndex(period, targetDate) }))
  .filter(({ period, dayIndex }) => dayIndex >= 0 && dayIndex < period.weeks * 7)
  .sort((left, right) => (
    Number(right.period.isCurrent) - Number(left.period.isCurrent)
    || right.dayIndex - left.dayIndex
  ))[0] || null

const resolveUpcomingPeriod = (
  periods: AcademicPeriod[],
  now: Date,
) => periods
  .map((period) => ({ period, startsAt: startOfDay(parseDate(period.startDate)) }))
  .filter(({ startsAt }) => (
    !Number.isNaN(startsAt.getTime())
    && startsAt.getTime() > startOfDay(now).getTime()
  ))
  .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime())[0] || null

const clockOnDate = (date: Date, clock: string) => {
  const [hours, minutes] = clock.split(':').map(Number)
  const result = startOfDay(date)
  result.setHours(hours, minutes, 0, 0)
  return result
}

const coursesOnDate = (
  cache: AcademicScheduleCache,
  customCourses: Course[],
  config: MiniappRuntimeConfig,
  selectedCampus: string,
  targetDate: Date,
) => {
  const resolved = resolvePeriodForDate(cache.periods, targetDate)
  if (!resolved) return { hasPeriod: false, items: [] as CoursePreviewItem[] }

  const { period, dayIndex } = resolved
  const week = Math.floor(dayIndex / 7) + 1
  const weekday = dayIndex % 7 + 1
  const officialCourses = cache.coursesByPeriod[period.id] || []
  const periodCourses = [
    ...officialCourses,
    ...customCourses.filter((course) => course.periodId === period.id),
  ]

  const items = periodCourses
    .filter((course) => (
      course.weekday === weekday
      && course.weeks.includes(week)
    ))
    .map((course): CoursePreviewItem | null => {
      const sections = getCampusSections(config, selectedCampus)
      const startTime = sections[String(course.startSection)]?.start || ''
      const endTime = sections[String(course.endSection)]?.end || ''
      if (!startTime || !endTime) return null
      const startsAt = clockOnDate(targetDate, startTime)
      const endsAt = clockOnDate(targetDate, endTime)
      return {
        course,
        startsAt,
        endsAt,
        status: 'upcoming',
        statusText: '',
      }
    })
    .filter((item): item is CoursePreviewItem => !!item)
    .sort((left, right) => (
      left.startsAt.getTime() - right.startsAt.getTime()
      || left.course.id.localeCompare(right.course.id)
    ))

  return { hasPeriod: true, items }
}

const buildCoursePreview = (
  targetDate: Date,
  dayLabel: CoursePreview['dayLabel'],
  hasPeriod: boolean,
  occurrences: CoursePreviewItem[],
  now: Date,
  limit: number,
  hasCache: boolean,
): CoursePreview => {
  const items = occurrences.map((item): CoursePreviewItem => {
    const ongoing = item.startsAt.getTime() <= now.getTime()
      && item.endsAt.getTime() > now.getTime()
    return {
      ...item,
      status: ongoing ? 'ongoing' : 'upcoming',
      statusText: ongoing
        ? `还有 ${Math.max(1, Math.ceil(
          (item.endsAt.getTime() - now.getTime()) / 60000,
        ))} 分钟`
        : '',
    }
  })
  const total = items.length
  const visibleItems = items.slice(0, limit)
  let emptyText = dayLabel === '明天' ? '明天没有课' : '今天没有后续课程'
  let emptyHint = '进入课表查看或刷新'
  if (!hasCache) emptyText = '课表尚未同步'
  else if (!hasPeriod) emptyText = '当前日期暂无学期安排'

  return {
    targetDate,
    dayLabel,
    dateLabel: `${targetDate.getMonth() + 1}月${targetDate.getDate()}日`,
    total,
    items: visibleItems,
    hiddenCount: Math.max(0, total - visibleItems.length),
    emptyText,
    emptyHint,
  }
}

export const resolveCoursePreview = (
  cache: AcademicScheduleCache | null,
  customCourses: Course[],
  config: MiniappRuntimeConfig,
  selectedCampus: string,
  now = new Date(),
  limit = 2,
): CoursePreview => {
  const today = startOfDay(now)
  const tomorrow = offsetDay(now, 1)
  const currentPeriod = cache
    ? resolvePeriodForDate(cache.periods, today)
    : null
  const upcomingPeriod = cache && !currentPeriod
    ? resolveUpcomingPeriod(cache.periods, now)
    : null

  if (upcomingPeriod) {
    const daysUntilStart = Math.max(1, Math.round(
      (upcomingPeriod.startsAt.getTime() - today.getTime()) / 86400000,
    ))
    return {
      targetDate: upcomingPeriod.startsAt,
      dayLabel: '假期',
      dateLabel: daysUntilStart === 1
        ? '明天开学'
        : `${upcomingPeriod.startsAt.getMonth() + 1}月${upcomingPeriod.startsAt.getDate()}日开学`,
      total: 0,
      items: [],
      hiddenCount: 0,
      emptyText: daysUntilStart === 1
        ? '假期最后一天，好好放松吧'
        : '享受假期吧',
      emptyHint: daysUntilStart === 1
        ? '明天开学，准备迎接新学期'
        : `距离开学还有 ${daysUntilStart} 天`,
    }
  }

  const todayResult = cache
    ? coursesOnDate(cache, customCourses, config, selectedCampus, today)
    : { hasPeriod: false, items: [] }
  const remainingToday = todayResult.items.filter(
    (item) => item.endsAt.getTime() > now.getTime(),
  )
  const showTomorrow = now.getHours() >= 22 || remainingToday.length === 0

  if (!showTomorrow) {
    return buildCoursePreview(
      today,
      '今天',
      todayResult.hasPeriod,
      remainingToday,
      now,
      limit,
      !!cache,
    )
  }

  const tomorrowResult = cache
    ? coursesOnDate(cache, customCourses, config, selectedCampus, tomorrow)
    : { hasPeriod: false, items: [] }
  return buildCoursePreview(
    tomorrow,
    '明天',
    tomorrowResult.hasPeriod,
    tomorrowResult.items,
    now,
    limit,
    !!cache,
  )
}

export const currentDateParts = (now = new Date()) => ({
  month: monthNames[now.getMonth()],
  day: String(now.getDate()),
})

export const avatarText = (username: string) => {
  const value = username.trim()
  return value ? value.slice(0, 1).toUpperCase() : '海'
}

export const noticeCategory = (notice: Notice) => {
  const value = notice.category.toLowerCase()
  if (value.includes('academic') || value.includes('course') || value.includes('exam')) return '教务'
  if (value.includes('market') || value.includes('trade') || value.includes('errand')) return '服务'
  if (value.includes('social') || value.includes('circle') || value.includes('comment')) return '互动'
  return '通知'
}

export const relativeTime = (value: string, now = Date.now()) => {
  const timestamp = apiDateTimeTimestamp(value)
  if (Number.isNaN(timestamp)) return '时间待确认'
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000))
  if (seconds < 60) return '刚刚'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}天前`
  const parts = apiDateTimeCampusParts(value)
  if (!parts) return '时间待确认'
  return `${parts.month}月${parts.day}日`
}

export const noticeTime = (notice: Notice) => (
  relativeTime(notice.published_at || notice.publish_at || notice.created_at)
)

export const marketplaceTime = (item: MarketplaceListingView) => relativeTime(item.created_at)
