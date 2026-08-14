import { strict as assert } from 'node:assert'
import {
  apiDateTimeCampusParts,
  apiDateTimeTimestamp,
  campusDateTimeToISOString,
  parseApiDateTime,
} from '../src/utils/date-time'
import {
  formatDateTime,
  relativeDeadline,
} from '../src/features/life-services/format'

process.env.TZ = 'UTC'

const utc = '2026-08-14T04:30:00Z'
const shanghai = '2026-08-14T12:30:00+08:00'
const legacyUTC = '2026-08-14T04:30:00'
const expectedTimestamp = Date.UTC(2026, 7, 14, 4, 30)

assert.equal(apiDateTimeTimestamp(utc), expectedTimestamp)
assert.equal(apiDateTimeTimestamp(shanghai), expectedTimestamp)
assert.equal(apiDateTimeTimestamp(legacyUTC), expectedTimestamp)
assert.equal(formatDateTime(utc), '08月14日 12:30')
assert.equal(formatDateTime(shanghai), '08月14日 12:30')
assert.equal(formatDateTime(legacyUTC), '08月14日 12:30')
assert.deepEqual(apiDateTimeCampusParts(utc), {
  year: 2026,
  month: 8,
  day: 14,
  hour: 12,
  minute: 30,
  date: '2026-08-14',
  time: '12:30',
})
assert.equal(campusDateTimeToISOString('2026-08-14', '12:30'), '2026-08-14T04:30:00.000Z')
assert.equal(
  relativeDeadline(utc, expectedTimestamp - 30 * 60_000),
  '30 分钟后截止',
)

assert.equal(parseApiDateTime('2026-02-30T12:00:00Z'), null)
assert.equal(parseApiDateTime('2026-08-14'), null)
assert.equal(campusDateTimeToISOString('2026-02-30', '12:00'), '')
assert.equal(campusDateTimeToISOString('2026-08-14', '25:00'), '')

console.log('date-time smoke tests passed')
