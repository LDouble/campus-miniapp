import type { MarketplaceListingView, Notice } from '../../api/types'
import type { AcademicScheduleCache } from '../../pages/academic/storage'
import type { Course } from '../../pages/academic/types'
import { parseDate, sectionTimes } from '../../pages/academic/utils'

const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const monthNames = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
]

export type NextCourse = {
  course: Course
  startsAt: Date
  startTime: string
  month: string
  day: string
  badge: string
}

const sameDay = (left: Date, right: Date) => (
  left.getFullYear() === right.getFullYear()
  && left.getMonth() === right.getMonth()
  && left.getDate() === right.getDate()
)

const nextDay = (value: Date) => {
  const result = new Date(value)
  result.setDate(result.getDate() + 1)
  return result
}

const courseBadge = (startsAt: Date, now: Date) => {
  const minutes = Math.max(0, Math.ceil((startsAt.getTime() - now.getTime()) / 60000))
  const time = `${String(startsAt.getHours()).padStart(2, '0')}:${String(startsAt.getMinutes()).padStart(2, '0')}`
  if (minutes < 60) return `还有 ${minutes} 分钟`
  if (sameDay(startsAt, now)) return `今天 ${time}`
  if (sameDay(startsAt, nextDay(now))) return `明天 ${time}`
  return `${weekdays[startsAt.getDay()]} ${time}`
}

export const resolveNextCourse = (
  cache: AcademicScheduleCache | null,
  now = new Date(),
): NextCourse | null => {
  if (!cache) return null
  const period = cache.periods.find((item) => item.isCurrent)
  if (!period) return null
  const start = parseDate(period.startDate)
  if (Number.isNaN(start.getTime())) return null

  const courses = cache.coursesByPeriod[period.id] || []
  let nearest: { course: Course; startsAt: Date; startTime: string } | null = null

  courses.forEach((course) => {
    const startTime = sectionTimes[course.startSection - 1]
    if (!startTime) return
    const parts = startTime.split(':').map(Number)
    course.weeks.forEach((week) => {
      if (week < 1 || week > period.weeks || course.weekday < 1 || course.weekday > 7) return
      const startsAt = new Date(start)
      startsAt.setDate(start.getDate() + (week - 1) * 7 + course.weekday - 1)
      startsAt.setHours(parts[0], parts[1], 0, 0)
      if (startsAt.getTime() < now.getTime()) return
      if (!nearest || startsAt.getTime() < nearest.startsAt.getTime()) {
        nearest = { course, startsAt, startTime }
      }
    })
  })

  if (!nearest) return null
  const result = nearest as { course: Course; startsAt: Date; startTime: string }
  return {
    ...result,
    month: monthNames[result.startsAt.getMonth()],
    day: String(result.startsAt.getDate()),
    badge: courseBadge(result.startsAt, now),
  }
}

export const currentDateParts = (now = new Date()) => ({
  month: monthNames[now.getMonth()],
  day: String(now.getDate()),
})

export const greeting = (username: string, now = new Date()) => {
  const hour = now.getHours()
  const salutation = hour < 6
    ? '夜深了'
    : hour < 11
      ? '早上好'
      : hour < 14
        ? '中午好'
        : hour < 18
          ? '下午好'
          : '晚上好'
  return `${salutation}，${username || '海大同学'}`
}

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
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return '时间待确认'
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000))
  if (seconds < 60) return '刚刚'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}天前`
  const date = new Date(timestamp)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

export const noticeTime = (notice: Notice) => (
  relativeTime(notice.published_at || notice.publish_at || notice.created_at)
)

export const marketplaceTime = (item: MarketplaceListingView) => relativeTime(item.created_at)
