import type {
  AcademicCalendar,
  AcademicCalendarEvent,
  AcademicCalendarTerm,
} from '../../api/types'

const DAY = 86400000

const dateOrdinal = (value: string | Date) => {
  const date = typeof value === 'string'
    ? new Date(`${value.slice(0, 10)}T00:00:00`)
    : value
  if (Number.isNaN(date.getTime())) return Number.NaN
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
}

export const calendarDateKey = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const strictDateOrdinal = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return Number.NaN
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime()) || calendarDateKey(date) !== value) return Number.NaN
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
}

const ordinalDateKey = (ordinal: number) => {
  if (!Number.isFinite(ordinal)) return null
  const date = new Date(ordinal)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

type ValidAcademicTerm = {
  term: AcademicCalendarTerm
  start: number
  end: number
}

const validAcademicTerm = (term: AcademicCalendarTerm): ValidAcademicTerm | null => {
  const start = strictDateOrdinal(term.start_date)
  const endDate = strictDateOrdinal(term.end_date)
  if (
    !Number.isFinite(start)
    || !Number.isFinite(endDate)
    || !Number.isInteger(term.week_count)
    || term.week_count < 1
    || endDate < start
    || new Date(start).getUTCDay() !== 1
  ) return null

  // A term cannot extend beyond its configured teaching-week count, even if a
  // source accidentally supplies a later end date.
  return {
    term,
    start,
    end: Math.min(endDate, start + term.week_count * 7 * DAY - DAY),
  }
}

export type AcademicWeekdayDate = {
  term: AcademicCalendarTerm
  week: number
  /** Monday is 1 and Sunday is 7. */
  weekday: number
  date: string
}

/**
 * Converts a teaching week and weekday to a calendar date. Teaching week one
 * starts on the term's `start_date`, which must be Monday.
 */
export const academicWeekdayToDate = (
  term: AcademicCalendarTerm,
  week: number,
  weekday: number,
) => {
  const validTerm = validAcademicTerm(term)
  if (
    !validTerm
    || !Number.isInteger(week)
    || !Number.isInteger(weekday)
    || week < 1
    || week > term.week_count
    || weekday < 1
    || weekday > 7
  ) return null

  const date = validTerm.start + ((week - 1) * 7 + weekday - 1) * DAY
  if (date > validTerm.end) return null
  return ordinalDateKey(date)
}

/**
 * Resolves a date to its teaching term, week and weekday. The matching term's
 * `start_date` is Monday, so Monday is represented as 1 and Sunday as 7.
 */
export const resolveAcademicWeekday = (
  calendar: AcademicCalendar | null,
  value: string,
): AcademicWeekdayDate | null => {
  const date = strictDateOrdinal(value)
  if (!Number.isFinite(date)) return null

  const matches = (calendar?.terms || [])
    .map(validAcademicTerm)
    .filter((term): term is ValidAcademicTerm => !!term)
    .filter((term) => date >= term.start && date <= term.end)
    .sort((left, right) => right.start - left.start)
  const match = matches[0]
  if (!match) return null

  const offset = Math.floor((date - match.start) / DAY)
  const week = Math.floor(offset / 7) + 1
  const weekday = offset % 7 + 1
  if (week > match.term.week_count) return null
  return { term: match.term, week, weekday, date: value }
}

export const formatCalendarDate = (value: string) => {
  const ordinal = dateOrdinal(value)
  if (!Number.isFinite(ordinal)) return value
  const date = new Date(ordinal)
  return `${date.getUTCMonth() + 1}月${date.getUTCDate()}日`
}

export const formatCalendarRange = (start: string, end: string) => (
  start === end
    ? formatCalendarDate(start)
    : `${formatCalendarDate(start)}—${formatCalendarDate(end)}`
)

export const normalizeAcademicCalendar = (
  calendar: AcademicCalendar,
): AcademicCalendar => ({
  ...calendar,
  terms: Array.isArray(calendar.terms) ? calendar.terms : [],
  events: Array.isArray(calendar.events)
    ? calendar.events.map((event) => ({
        ...event,
        campuses: Array.isArray(event.campuses) ? event.campuses : [],
      }))
    : [],
})

export type AcademicCalendarState =
  | {
    kind: 'current'
    term: AcademicCalendarTerm
    week: number
    daysUntilStart: 0
  }
  | {
    kind: 'upcoming'
    term: AcademicCalendarTerm
    week: 1
    daysUntilStart: number
  }
  | {
    kind: 'finished'
    term: AcademicCalendarTerm
    week: 0
    daysUntilStart: 0
  }
  | {
    kind: 'unavailable'
    term: null
    week: 0
    daysUntilStart: 0
  }

export const resolveAcademicCalendarState = (
  calendar: AcademicCalendar | null,
  now = new Date(),
): AcademicCalendarState => {
  const today = dateOrdinal(now)
  const timeline = (calendar?.terms || [])
    .map((term) => ({
      term,
      start: dateOrdinal(term.start_date),
      end: dateOrdinal(term.end_date),
    }))
    .filter(({ start, end }) => Number.isFinite(start) && Number.isFinite(end))

  const current = timeline
    .filter(({ start, end }) => today >= start && today <= end)
    .sort((left, right) => right.start - left.start)[0]
  if (current) {
    return {
      kind: 'current',
      term: current.term,
      week: Math.min(
        current.term.week_count,
        Math.max(1, Math.floor((today - current.start) / (7 * DAY)) + 1),
      ),
      daysUntilStart: 0,
    }
  }

  const upcoming = timeline
    .filter(({ start }) => start > today)
    .sort((left, right) => left.start - right.start)[0]
  if (upcoming) {
    return {
      kind: 'upcoming',
      term: upcoming.term,
      week: 1,
      daysUntilStart: Math.max(1, Math.ceil((upcoming.start - today) / DAY)),
    }
  }

  const finished = timeline
    .filter(({ end }) => end < today)
    .sort((left, right) => right.end - left.end)[0]
  if (finished) {
    return {
      kind: 'finished',
      term: finished.term,
      week: 0,
      daysUntilStart: 0,
    }
  }

  return {
    kind: 'unavailable',
    term: null,
    week: 0,
    daysUntilStart: 0,
  }
}

export const orderedAcademicCalendarTerms = (
  calendar: AcademicCalendar | null,
) => [...(calendar?.terms || [])].sort((left, right) => (
  right.start_date.localeCompare(left.start_date)
  || right.id.localeCompare(left.id)
))

export const resolveAcademicCalendarTerm = (
  calendar: AcademicCalendar | null,
  selectedTermID = '',
  now = new Date(),
) => {
  const selected = calendar?.terms.find((term) => term.id === selectedTermID)
  return selected || resolveAcademicCalendarState(calendar, now).term
}

export const academicCalendarLabel = (
  calendar: AcademicCalendar | null,
  now = new Date(),
) => {
  const state = resolveAcademicCalendarState(calendar, now)
  if (state.kind === 'current') return `第 ${state.week} 周`
  if (state.kind === 'upcoming') return `${formatCalendarDate(state.term.start_date)}开学`
  if (state.kind === 'finished') return '本学期已结束'
  return '教学周次待同步'
}

export const calendarEventsForTerm = (
  calendar: AcademicCalendar | null,
  termID: string,
) => {
  const terms = [...(calendar?.terms || [])].sort((left, right) => (
    left.start_date.localeCompare(right.start_date)
    || left.id.localeCompare(right.id)
  ))
  const selectedIndex = terms.findIndex((term) => term.id === termID)
  if (selectedIndex < 0) return []

  const selected = terms[selectedIndex]
  const next = terms.slice(selectedIndex + 1)
    .find((term) => term.start_date > selected.start_date)

  return [...(calendar?.events || [])]
    .filter((event) => {
      if (event.period_id) return event.period_id === termID
      return event.end_date >= selected.start_date
        && (!next || event.start_date < next.start_date)
    })
    .sort((left, right) => (
      left.start_date.localeCompare(right.start_date)
      || left.title.localeCompare(right.title)
    ))
}

export const calendarEventsAfter = (
  events: AcademicCalendarEvent[],
  date = calendarDateKey(),
) => events.filter((event) => event.end_date >= date)
