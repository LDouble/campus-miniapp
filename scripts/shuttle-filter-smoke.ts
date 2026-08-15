import { strict as assert } from 'node:assert'
import {
  filterShuttleJourneys,
  shuttleDestinationOptions,
  shuttleOriginOptions,
} from '../src/features/shuttle/local-filter'
import type { ShuttleRoute } from '../src/features/shuttle/repository'

const route = {
  id: 1,
  name: '测试线路',
  origin: 'A站',
  destination: 'C站',
  service_type: 'intercampus',
  reference_duration_minutes: 30,
  stops: [
    { campus: '鱼山校区', name: 'A站', offset_minutes: 0 },
    { campus: '鱼山校区', name: 'B站', offset_minutes: 15 },
    { campus: '崂山校区', name: 'C站', offset_minutes: 30 },
  ],
  resolved_schedule: {
    service_date: '2026-08-15',
    day_type: 'saturday',
    source: 'weekly_rule',
    suspended: false,
    departure_times: ['07:00', '08:00', '09:00'],
    next_departure_at: '2026-08-14T23:00:00.000Z',
    trips: [
      { stop_times: [
        { stop_name: 'A站', time: '07:00' },
        { stop_name: 'B站', time: '07:15' },
        { stop_name: 'C站', time: '07:30' },
      ] },
      { stop_times: [
        { stop_name: 'A站', time: '08:00' },
        { stop_name: 'B站', time: '08:15' },
      ] },
      { stop_times: [
        { stop_name: 'B站', time: '09:00' },
        { stop_name: 'C站', time: '09:20' },
      ] },
    ],
  },
} as ShuttleRoute

assert.deepEqual(shuttleOriginOptions([route]), ['A站', 'B站'])
assert.deepEqual(shuttleDestinationOptions([route], 'A站'), ['B站', 'C站'])
assert.deepEqual(shuttleDestinationOptions([route], 'B站'), ['C站'])

const direct = filterShuttleJourneys(
  [route],
  '2026-08-15',
  'A站',
  'C站',
  new Date('2026-08-14T22:50:00.000Z').getTime(),
)
assert.equal(direct.length, 1)
assert.deepEqual(direct[0].departureTimes, ['07:00'])
assert.equal(direct[0].stopCount, 3)
assert.equal(direct[0].durationMinutes, 30)

const middle = filterShuttleJourneys(
  [route],
  '2026-08-15',
  'B站',
  'C站',
  new Date('2026-08-14T22:50:00.000Z').getTime(),
)
assert.deepEqual(middle[0].departureTimes, ['07:15', '09:00'])
assert.equal(middle[0].nextDepartureAt, '2026-08-14T23:15:00.000Z')

assert.deepEqual(
  filterShuttleJourneys([route], '2026-08-15', 'C站', 'A站'),
  [],
)
assert.deepEqual(
  filterShuttleJourneys([route], '2026-08-15')[0].departureTimes,
  route.resolved_schedule.departure_times,
)

console.log('shuttle local filter smoke passed')
