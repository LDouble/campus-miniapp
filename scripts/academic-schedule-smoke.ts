import { strict as assert } from 'node:assert'
import {
  getCoursesForPeriod,
  requireCoursesForPeriod,
  sanitizeCoursesByPeriod,
  setCoursesForPeriod,
} from '../src/pages/academic/schedule-courses'
import { Course } from '../src/pages/academic/types'

const course = (id: string, periodId: string): Course => ({
  id,
  periodId,
  name: id,
  teacher: '教师',
  location: '教室',
  weekday: 1,
  startSection: 1,
  endSection: 2,
  weeks: [1],
  color: 'aqua',
  source: 'official',
})

const periodA = course('A-课程', 'A')
const periodB = course('B-课程', 'B')

assert.deepEqual(
  sanitizeCoursesByPeriod({ A: [periodA], B: [periodB, periodA] }),
  { A: [periodA] },
  '读取缓存时必须丢弃被其他学期课程污染的整个分桶以触发重新拉取',
)

assert.throws(
  () => requireCoursesForPeriod([periodA, periodB], 'A'),
  /period mismatch/,
  '接口混入其他学期课程时不得写入当前学期缓存',
)

let coursesByPeriod = setCoursesForPeriod({}, 'A', [periodA])
coursesByPeriod = setCoursesForPeriod(coursesByPeriod, 'B', [periodB])
coursesByPeriod = setCoursesForPeriod(coursesByPeriod, 'A', [periodA])
assert.deepEqual(
  getCoursesForPeriod(coursesByPeriod, 'A'),
  [periodA],
  'A→B→A 后只能展示 A 学期课程',
)

const afterLatePeriodBResponse = setCoursesForPeriod(
  coursesByPeriod,
  'B',
  [{ ...periodB, id: 'B-延迟响应' }],
)
assert.deepEqual(
  getCoursesForPeriod(afterLatePeriodBResponse, 'A'),
  [periodA],
  'B 学期延迟响应不得覆盖当前 A 学期课程',
)

process.stdout.write('academic schedule isolation smoke: ok\n')
