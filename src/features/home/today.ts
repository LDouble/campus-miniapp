import type {
  AcademicCalendar,
  AcademicCalendarEvent,
  DailyCheckinStatus,
  UserLevelTask,
} from '../../api/types'

export type TodayTask = {
  actionLabel: string
  completed: boolean
  description: string
  route: string
  title: string
}

const localDate = (value: Date) => {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const upcomingHomeCalendarEvents = (
  calendar: AcademicCalendar | null,
  campusName: string,
  now = new Date(),
  limit = 2,
): AcademicCalendarEvent[] => {
  if (!calendar) return []
  const today = localDate(now)
  const cutoffDate = new Date(now)
  cutoffDate.setDate(cutoffDate.getDate() + 14)
  const cutoff = localDate(cutoffDate)
  return [...calendar.events]
    .filter((event) => (
      event.homepage_recommended
      && event.end_date >= today
      && event.start_date <= cutoff
      && (event.campuses.length === 0 || event.campuses.includes(campusName))
    ))
    .sort((left, right) => (
      left.start_date.localeCompare(right.start_date)
      || (left.priority === right.priority ? 0 : left.priority === 'important' ? -1 : 1)
      || left.title.localeCompare(right.title)
    ))
    .slice(0, limit)
}

export const calendarEventDateLabel = (
  event: AcademicCalendarEvent,
  now = new Date(),
) => {
  const today = localDate(now)
  const tomorrowDate = new Date(now)
  tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const tomorrow = localDate(tomorrowDate)
  if (event.start_date <= today && event.end_date >= today) return '今天'
  if (event.start_date === tomorrow) return '明天'
  return `${Number(event.start_date.slice(5, 7))}月${Number(event.start_date.slice(8, 10))}日`
}

export const resolveTodayTask = (
  checkin: DailyCheckinStatus | null,
  tasks: UserLevelTask[],
): TodayTask | null => {
  if (checkin?.enabled && !checkin.checked_in) {
    return {
      actionLabel: '去签到',
      completed: false,
      description: `完成可得 ${checkin.today_reward} 经验，连续 ${checkin.consecutive_days} 天`,
      route: '/pages/daily-checkin/index',
      title: '完成今日签到',
    }
  }
  const pending = tasks.find((task) => task.status === 'pending')
  if (pending) {
    return {
      actionLabel: pending.key === 'first_comment_approved' ? '去评论' : '去发布',
      completed: false,
      description: `${pending.description} · +${pending.reward} 经验`,
      route: '/pages/community/index',
      title: pending.title,
    }
  }
  if (checkin?.checked_in) {
    return {
      actionLabel: '查看记录',
      completed: true,
      description: `连续 ${checkin.consecutive_days} 天，今日已获得 ${checkin.today_reward} 经验`,
      route: '/pages/daily-checkin/index',
      title: '今日签到已完成',
    }
  }
  return null
}
