import type { DailyCheckinHistoryItem } from '../../api/types'

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/u
const DATE_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/u

export const DAILY_CHECKIN_HISTORY_MONTHS = 12

type MonthParts = {
  year: number
  month: number
}

export type DailyCheckinCalendarCell = {
  key: string
  date: string | null
  day: number | null
  checkedIn: boolean
  reward: number | null
  isServerDate: boolean
  isFuture: boolean
}

const parseMonth = (value: string): MonthParts | null => {
  const match = MONTH_PATTERN.exec(value)
  if (!match) return null
  return { year: Number(match[1]), month: Number(match[2]) }
}

const formatMonth = ({ year, month }: MonthParts) => (
  `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`
)

export const monthFromServerDate = (serverDate: string) => (
  DATE_PATTERN.test(serverDate) ? serverDate.slice(0, 7) : ''
)

export const shiftCheckinMonth = (value: string, offset: number) => {
  const parsed = parseMonth(value)
  if (!parsed || !Number.isInteger(offset)) return ''
  const absoluteMonth = parsed.year * 12 + parsed.month - 1 + offset
  const year = Math.floor(absoluteMonth / 12)
  const month = ((absoluteMonth % 12) + 12) % 12 + 1
  return formatMonth({ year, month })
}

export const checkinMonthLabel = (value: string) => {
  const parsed = parseMonth(value)
  return parsed ? `${parsed.year} 年 ${parsed.month} 月` : value
}

export const checkinMonthRange = (serverDate: string) => {
  const latest = monthFromServerDate(serverDate)
  return {
    earliest: latest ? shiftCheckinMonth(latest, -DAILY_CHECKIN_HISTORY_MONTHS) : '',
    latest,
  }
}

export const isCheckinMonthAvailable = (month: string, serverDate: string) => {
  const { earliest, latest } = checkinMonthRange(serverDate)
  return !!parseMonth(month) && !!earliest && month >= earliest && month <= latest
}

const monthDayCount = ({ year, month }: MonthParts) => (
  new Date(Date.UTC(year, month, 0)).getUTCDate()
)

const firstWeekday = ({ year, month }: MonthParts) => (
  new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
)

export const buildDailyCheckinCalendar = (
  month: string,
  items: DailyCheckinHistoryItem[],
  serverDate: string,
): DailyCheckinCalendarCell[] => {
  const parsed = parseMonth(month)
  if (!parsed) return []

  const offset = firstWeekday(parsed)
  const days = monthDayCount(parsed)
  const cellCount = Math.ceil((offset + days) / 7) * 7
  const rewards = new Map(items.map((item) => [item.date, item.reward]))

  return Array.from({ length: cellCount }, (_, index) => {
    const day = index - offset + 1
    if (day < 1 || day > days) {
      return {
        key: `placeholder-${index}`,
        date: null,
        day: null,
        checkedIn: false,
        reward: null,
        isServerDate: false,
        isFuture: false,
      }
    }
    const date = `${month}-${String(day).padStart(2, '0')}`
    const reward = rewards.get(date)
    return {
      key: date,
      date,
      day,
      checkedIn: reward !== undefined,
      reward: reward ?? null,
      isServerDate: date === serverDate,
      isFuture: !!serverDate && date > serverDate,
    }
  })
}
