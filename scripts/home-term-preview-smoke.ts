import * as assert from 'node:assert/strict'
import type { AcademicScheduleCache } from '../src/pages/academic/storage'
import type { Course } from '../src/pages/academic/types'

// 仅替换运行时配置的 I/O；日期、学期与课程筛选使用真实实现。
const runtimePath = require.resolve('../src/features/runtime-config')
require.cache[runtimePath] = {
  id: runtimePath, filename: runtimePath, loaded: true,
  exports: { getCampusSections: () => ({ '1': { start: '08:00', end: '08:50' }, '2': { start: '09:00', end: '09:50' } }) },
} as NodeModule
const { resolveCoursePreview, tomorrowStartingPeriod } = require('../src/features/home/data')
const course: Course = {
  id: 'math', periodId: 'new-term', name: '数学', teacher: '', location: 'A101',
  weekday: 1, startSection: 1, endSection: 2, weeks: [1], color: 'aqua', source: 'official',
}
const cache: AcademicScheduleCache = {
  version: 1, platformUserId: 1,
  periods: [{ id: 'new-term', label: '新学期', shortLabel: '秋', startDate: '2026/09/21', weeks: 18, isCurrent: false }],
  coursesByPeriod: { 'new-term': [course] }, coursesUpdatedAtByPeriod: {},
}
const preview = (now: Date, value: AcademicScheduleCache | null = cache) => resolveCoursePreview(value, [], {}, '崂山校区', now)
for (const hour of [0, 12, 23]) {
  const now = new Date(2026, 8, 20, hour)
  const result = preview(now)
  assert.equal(result.dayLabel, '明天')
  assert.deepEqual(result.items.map((item: {course: Course}) => item.course.id), ['math'])
  assert.equal(result.items[0].status, 'upcoming')
  assert.equal(tomorrowStartingPeriod(cache.periods, now)?.id, 'new-term')
}
assert.equal(preview(new Date(2026, 8, 19)).dayLabel, '假期')
assert.equal(tomorrowStartingPeriod(cache.periods, new Date(2026, 8, 19)), null)
assert.equal(preview(new Date(2026, 8, 21, 8, 10)).items[0].status, 'ongoing')
assert.equal(preview(new Date(2026, 8, 20), { ...cache, coursesByPeriod: {} }).emptyText, '课表尚未同步')
assert.equal(preview(new Date(2026, 8, 20), { ...cache, coursesByPeriod: { 'new-term': [] } }).emptyText, '明天没有课')
assert.equal(preview(new Date(2026, 8, 20), null).dayLabel, '今天')
console.log('home term preview smoke: ok')
