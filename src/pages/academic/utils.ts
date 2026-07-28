import {
  AcademicPeriod,
  ExamRecord,
  GradePeriod,
  GradeRecord,
} from './types'

export const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

export const sectionTimes = [
  '08:00', '08:55', '09:50', '10:45', '14:00', '14:55',
  '16:00', '16:55', '18:30', '19:25', '20:20', '21:15',
]

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
  const start = parseDate(period?.startDate || '2026/02/23')
  start.setDate(start.getDate() + (week - 1) * 7)
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return date
  })
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
