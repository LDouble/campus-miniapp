import {
  AcademicPeriod,
  ExamRecord,
  GradePeriod,
  GradeRecord,
} from './types'

export const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

export const courseColors = [
  'aqua', 'blue', 'mint', 'lilac', 'sand', 'sky',
  'rose', 'peach', 'lemon', 'sage', 'indigo', 'coral',
]

export const pad = (value: number) => String(value).padStart(2, '0')

export const parseDate = (value: string) => new Date(value.replace(/-/g, '/'))

export const formatMonthDay = (date: Date) => `${pad(date.getMonth() + 1)}.${pad(date.getDate())}`

export const formatDateLabel = (date: Date) => `${date.getMonth() + 1}月${date.getDate()}日`

export const formatExamDate = (value: string) => {
  const date = parseDate(value)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

export const formatExamTime = (startAt: string, endAt: string) => (
  `${startAt.slice(-5)} - ${endAt.slice(-5)}`
)

export const getPeriodLabel = (periods: AcademicPeriod[], id: string) => (
  periods.find((period) => period.id === id)?.shortLabel || '选择学期'
)

export const resolvePeriodId = (periods: AcademicPeriod[], preferredId: string) => {
  if (periods.some((period) => period.id === preferredId)) return preferredId
  return periods.find((period) => period.isCurrent)?.id || periods[0]?.id || ''
}

const undergraduateGradePeriodPattern = /^(\d{4})-(\d{4})-([123])$/
const graduateGradePeriodPattern = /^(\d{4}):(11|12)$/

export const formatGradePeriod = (value: string): GradePeriod => {
  const id = value.trim()
  const undergraduate = undergraduateGradePeriodPattern.exec(id)
  if (undergraduate) {
    const [, startYear, endYear, term] = undergraduate
    const year = term === '3' ? endYear : startYear
    const season = term === '1' ? '夏季' : term === '2' ? '秋季' : '春季'
    return {
      id,
      label: `${year}${season}学期`,
      shortLabel: `${year.slice(2)}${season.slice(0, 1)}`,
    }
  }

  const graduate = graduateGradePeriodPattern.exec(id)
  if (graduate) {
    const [, startYear, term] = graduate
    const endYear = String(Number(startYear) + 1)
    const season = term === '11' ? '夏秋' : '春'
    return {
      id,
      label: `${startYear}-${endYear}学年 ${season}`,
      shortLabel: `${startYear.slice(2)}-${endYear.slice(2)} ${season}`,
    }
  }

  return { id, label: id || '未识别学期', shortLabel: id || '未识别学期' }
}

export const deriveGradePeriods = (grades: GradeRecord[]): GradePeriod[] => {
  const seen = new Set<string>()
  const periods: GradePeriod[] = []
  grades.forEach((grade) => {
    const id = grade.periodId.trim()
    if (!id || seen.has(id)) return
    seen.add(id)
    periods.push(formatGradePeriod(id))
  })
  return periods
}

export const getGradePeriodLabel = (periods: GradePeriod[], id: string) => (
  periods.find((period) => period.id === id)?.shortLabel
  || formatGradePeriod(id).shortLabel
)

export const getWeekDates = (period: AcademicPeriod | undefined, week: number) => {
  if (!period) return []
  const start = parseDate(period.startDate)
  start.setDate(start.getDate() + (week - 1) * 7)
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return date
  })
}

const localDateOrdinal = (date: Date) => Date.UTC(
  date.getFullYear(),
  date.getMonth(),
  date.getDate(),
)

export const getCurrentTeachingWeek = (
  period: AcademicPeriod,
  now = new Date(),
) => {
  const start = parseDate(period.startDate)
  if (Number.isNaN(start.getTime()) || period.weeks < 1) return 1
  const elapsedDays = Math.floor(
    (localDateOrdinal(now) - localDateOrdinal(start)) / 86400000,
  )
  const week = Math.floor(elapsedDays / 7) + 1
  return Math.min(period.weeks, Math.max(1, week))
}

export const getCurrentAcademicWeek = (
  periods: AcademicPeriod[],
  now = new Date(),
) => {
  const today = localDateOrdinal(now)
  const currentPeriod = periods.find((period) => {
    const start = parseDate(period.startDate)
    if (Number.isNaN(start.getTime()) || period.weeks < 1) return false
    const startOrdinal = localDateOrdinal(start)
    const endOrdinal = startOrdinal + period.weeks * 7 * 86400000
    return today >= startOrdinal && today < endOrdinal
  })
  return currentPeriod ? getCurrentTeachingWeek(currentPeriod, now) : null
}

export const getAcademicCalendarLabel = (
  periods: AcademicPeriod[],
  now = new Date(),
) => {
  const currentWeek = getCurrentAcademicWeek(periods, now)
  if (currentWeek) return `第 ${currentWeek} 周`

  const today = localDateOrdinal(now)
  const upcoming = periods
    .map((period) => ({ period, start: parseDate(period.startDate) }))
    .filter(({ start }) => (
      !Number.isNaN(start.getTime()) && localDateOrdinal(start) > today
    ))
    .sort((left, right) => left.start.getTime() - right.start.getTime())[0]
  if (upcoming) return `${formatDateLabel(upcoming.start)}开学`

  const hasConfiguredPeriod = periods.some((period) => (
    !Number.isNaN(parseDate(period.startDate).getTime())
  ))
  return hasConfiguredPeriod ? '本学期已结束' : '教学周次待同步'
}

export const formatPeriodStartDate = (period: AcademicPeriod) => {
  const start = parseDate(period.startDate)
  return `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}日`
}

export const isSameDay = (left: Date, right: Date) => (
  left.getFullYear() === right.getFullYear()
  && left.getMonth() === right.getMonth()
  && left.getDate() === right.getDate()
)

export const getExamStatus = (exam: ExamRecord) => {
  const now = Date.now()
  const start = parseDate(exam.startAt).getTime()
  const end = parseDate(exam.endAt).getTime()
  if (now < start) return 'upcoming'
  if (now <= end) return 'ongoing'
  return 'finished'
}

export const getExamStatusLabel = (exam: ExamRecord) => {
  const status = getExamStatus(exam)
  if (status === 'ongoing') return '进行中'
  if (status === 'finished') return '已结束'
  const days = Math.max(1, Math.ceil((parseDate(exam.startAt).getTime() - Date.now()) / 86400000))
  return `${days} 天后`
}
