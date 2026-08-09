import { strict as assert } from 'node:assert'
import type { AcademicCalendar } from '../src/api/types'
import {
  calendarEventsForTerm,
  normalizeAcademicCalendar,
  orderedAcademicCalendarTerms,
  resolveAcademicCalendarState,
  resolveAcademicCalendarTerm,
} from '../src/features/calendar/utils'

const calendar: AcademicCalendar = {
  education_level: 'undergraduate',
  timezone: 'Asia/Shanghai',
  refreshed_at: '2026-07-30T00:00:00Z',
  terms: [
    {
      id: 'spring',
      label: '2025-2026学年 春',
      short_label: '25-26 春',
      start_date: '2026-02-23',
      end_date: '2026-07-12',
      week_count: 20,
      is_current: false,
    },
    {
      id: 'autumn',
      label: '2026-2027学年 秋',
      short_label: '26-27 秋',
      start_date: '2026-08-31',
      end_date: '2027-01-17',
      week_count: 20,
      is_current: false,
    },
  ],
  events: [],
}

const upcoming = resolveAcademicCalendarState(
  calendar,
  new Date('2026-07-30T12:00:00+08:00'),
)
assert.equal(upcoming.kind, 'upcoming')
assert.equal(upcoming.term.id, 'autumn')
assert.equal(upcoming.week, 1)

const current = resolveAcademicCalendarState(
  calendar,
  new Date('2026-09-14T12:00:00+08:00'),
)
assert.equal(current.kind, 'current')
assert.equal(current.term.id, 'autumn')
assert.equal(current.week, 3)

const finished = resolveAcademicCalendarState(
  calendar,
  new Date('2027-02-01T12:00:00+08:00'),
)
assert.equal(finished.kind, 'finished')
assert.equal(finished.term.id, 'autumn')

assert.equal(
  resolveAcademicCalendarTerm(calendar, 'spring')?.id,
  'spring',
)
assert.deepEqual(
  orderedAcademicCalendarTerms(calendar).map((term) => term.id),
  ['autumn', 'spring'],
)

const normalized = normalizeAcademicCalendar({
  ...calendar,
  events: [{
    id: 'opening',
    title: '开学',
    type: 'term_start',
    start_date: '2026-08-31',
    end_date: '2026-08-31',
    period_id: 'autumn',
    campuses: null,
    description: '',
  }],
} as unknown as AcademicCalendar)
assert.deepEqual(normalized.events[0].campuses, [])

const eventCalendar: AcademicCalendar = {
  ...calendar,
  terms: [
    calendar.terms[0],
    {
      id: 'summer',
      label: '2025-2026学年 夏',
      short_label: '25-26 夏',
      start_date: '2026-08-24',
      end_date: '2026-09-19',
      week_count: 4,
      is_current: false,
    },
    {
      ...calendar.terms[1],
      start_date: '2026-09-20',
    },
    {
      ...calendar.terms[0],
      id: 'next-spring',
      label: '2026-2027学年 春',
      short_label: '26-27 春',
      start_date: '2027-03-01',
      end_date: '2027-07-18',
    },
  ],
  events: [
    {
      id: 'spring-exam',
      title: '春季考试',
      type: 'exam',
      start_date: '2026-07-07',
      end_date: '2026-07-16',
      period_id: 'spring',
      campuses: [],
      description: '',
    },
    {
      id: 'summer-vacation',
      title: '暑假',
      type: 'holiday',
      start_date: '2026-07-17',
      end_date: '2026-08-22',
      period_id: '',
      campuses: [],
      description: '',
    },
    {
      id: 'autumn-anniversary',
      title: '校庆日',
      type: 'other',
      start_date: '2026-10-25',
      end_date: '2026-10-25',
      period_id: 'autumn',
      campuses: [],
      description: '',
    },
    {
      id: 'winter-vacation',
      title: '寒假',
      type: 'holiday',
      start_date: '2027-01-26',
      end_date: '2027-02-27',
      period_id: '',
      campuses: [],
      description: '',
    },
    {
      id: 'next-summer-vacation',
      title: '下一学年暑假',
      type: 'holiday',
      start_date: '2027-07-19',
      end_date: '2027-08-21',
      period_id: '',
      campuses: [],
      description: '',
    },
  ],
}

assert.deepEqual(
  calendarEventsForTerm(eventCalendar, 'spring').map((event) => event.id),
  ['spring-exam', 'summer-vacation'],
)
assert.deepEqual(calendarEventsForTerm(eventCalendar, 'summer'), [])
assert.deepEqual(
  calendarEventsForTerm(eventCalendar, 'autumn').map((event) => event.id),
  ['autumn-anniversary', 'winter-vacation'],
)
assert.deepEqual(
  calendarEventsForTerm(eventCalendar, 'next-spring').map((event) => event.id),
  ['next-summer-vacation'],
)
assert.deepEqual(calendarEventsForTerm(eventCalendar, 'missing'), [])

console.log('calendar rules: ok')
