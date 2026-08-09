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
