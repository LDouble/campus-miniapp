import { strict as assert } from 'node:assert'
import type { AcademicCalendar } from '../src/api/types'
import {
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

console.log('calendar rules: ok')
