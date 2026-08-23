import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  getCourseScheduleKey,
  getCoursesForPeriod,
  getCoursesForWeek,
  requireCoursesForPeriod,
  sanitizeCoursesByPeriod,
  setCoursesForPeriod,
} from '../src/pages/academic/schedule-courses'
import { Course } from '../src/pages/academic/types'
import {
  courseColorForClass,
  formatCourseTimeRange,
  formatCourseWeeks,
  resolveHorizontalSwipeWeek,
} from '../src/pages/academic/utils'

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

const academicRepositorySource = readFileSync(
  resolve(__dirname, '../src/pages/academic/repository.ts'),
  'utf8',
)
const academicStorageSource = readFileSync(
  resolve(__dirname, '../src/pages/academic/storage.ts'),
  'utf8',
)
const schedulePageSource = readFileSync(
  resolve(__dirname, '../src/pages/academic/schedule/index.tsx'),
  'utf8',
)
const academicSchemaSource = readFileSync(
  resolve(__dirname, '../src/api/generated/schema.ts'),
  'utf8',
)
const academicStyleSource = readFileSync(
  resolve(__dirname, '../src/pages/academic/index.scss'),
  'utf8',
)
const runtimeConfigSource = readFileSync(
  resolve(__dirname, '../src/features/runtime-config/index.ts'),
  'utf8',
)

assert.match(
  academicSchemaSource,
  /AcademicCourse:\s*\{[\s\S]*?note:\s*string;/u,
  '教务课程接口必须声明课程备注字段',
)
assert.match(
  academicSchemaSource,
  /AcademicCourseListResponseBody:\s*\{[\s\S]*?schedule_note:\s*string;/u,
  '教务课表接口必须声明全局课表备注字段',
)
assert.match(academicRepositorySource, /note:\s*course\.note/u, '课程映射必须保留课程备注')
assert.match(academicRepositorySource, /class_num/u, '课程颜色映射必须优先读取 class_num')
assert.doesNotMatch(
  academicRepositorySource,
  /stableColor\(course\.id\)/u,
  '课程颜色不得再根据课程 id 计算',
)
assert.match(
  academicRepositorySource,
  /scheduleNote:\s*result\.scheduleNote/u,
  '课表仓储必须保留全局课表备注',
)
assert.match(
  academicStorageSource,
  /scheduleNotesByPeriod/u,
  '课表缓存必须按学期保存全局课表备注',
)
assert.match(
  schedulePageSource,
  /schedule-note__track--marquee[\s\S]*?schedule-note__copy--duplicate/u,
  '课表页必须用双文本无缝跑马灯展示全局课表备注',
)
assert.match(
  schedulePageSource,
  /className='course-conflict-card__note'/u,
  '课程详情浮层必须展示课程备注',
)
assert.match(schedulePageSource, /getSectionEndTime/u, '课程表必须读取结束时间')
assert.match(schedulePageSource, /timetable-course__time/u, '周课表课程块必须展示时间区间')
assert.match(schedulePageSource, /className='timetable__time-start'/u, '左侧节次栏必须展示开始时间')
assert.match(schedulePageSource, /className='timetable__time-section'/u, '左侧节次栏必须展示节次')
assert.match(schedulePageSource, /className='timetable__time-end'/u, '左侧节次栏必须展示结束时间')
assert.doesNotMatch(schedulePageSource, /className='timetable__time-range'/u, '左侧节次栏不应展示箭头时间区间')
assert.match(runtimeConfigSource, /export const getSectionEndTime/u, '运行时配置必须提供节次结束时间')
assert.equal(
  formatCourseTimeRange('08:00', '09:40'),
  '08:00 -> 09:40',
  '课程时间应展示开始到结束的区间',
)
assert.equal(
  formatCourseTimeRange('', '09:40'),
  '',
  '缺少任一端时间时应安全回退',
)
const primaryClassColor = courseColorForClass('class-101')
const differentClassNumber = ['class-102', 'class-103', 'class-104']
  .find((classNumber) => courseColorForClass(classNumber) !== primaryClassColor)
assert.ok(differentClassNumber, '不同 class_num 至少应能产生可区分的课程颜色')
assert.equal(
  courseColorForClass('class-101'),
  primaryClassColor,
  '同一 class_num 必须保持稳定课程颜色',
)
assert.match(
  academicStyleSource,
  /详情卡片使用统一中性承载面[\s\S]*?\.course-float-card\s*\{[\s\S]*?background:\s*var\(--campus-surface/u,
  '课程详情浮层应使用统一中性承载面',
)
assert.match(
  academicStyleSource,
  /\.course-resource-actions--course-card\s*\{[\s\S]*?border-radius:\s*var\(--ousea-radius-card-sm/u,
  '课程操作入口应使用紧凑的 Ousea 卡片容器',
)
assert.match(
  academicStyleSource,
  /\.course-conflict-card\s*\{[\s\S]*?border-left-width:\s*8rpx[\s\S]*?border-left-color:\s*var\(--ousea-ocean-500/u,
  '课程冲突卡片应使用左侧强调轨区分课程色',
)

const periodA = course('A-课程', 'A')
const periodB = course('B-课程', 'B')

assert.deepEqual(
  getCoursesForWeek([
    { ...periodA, id: '仅第一周', weeks: [1] },
    { ...periodA, id: '仅第二周', weeks: [2] },
    { ...periodA, id: '第一二周', weeks: [1, 2] },
  ], 1).map((item) => item.id),
  ['仅第一周', '第一二周'],
  '周课表只能展示当前教学周的课程，其他周课程不得形成冲突提示',
)

assert.notEqual(
  getCourseScheduleKey(course('同一课程', '夏季')),
  getCourseScheduleKey(course('同一课程', '春季')),
  '跨学期复用课程 ID 时也必须生成不同的渲染键',
)
assert.notEqual(
  getCourseScheduleKey(course('同一课程', '夏季')),
  getCourseScheduleKey({
    ...course('同一课程', '夏季'),
    weekday: 2,
    startSection: 3,
    endSection: 4,
  }),
  '同一学期同一课程的不同排课时段必须生成不同的渲染键',
)

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

assert.equal(
  formatCourseWeeks([1, 2, 3, 4, 5, 6, 7, 8]),
  '第 1-8 周',
  '连续周次应合并为一个区间',
)
assert.equal(
  formatCourseWeeks([1, 3, 5, 7]),
  '第 1-7 周（单）',
  '连续单周应合并为单周区间',
)
assert.equal(
  formatCourseWeeks([2, 4, 6, 8]),
  '第 2-8 周（双）',
  '连续双周应合并为双周区间',
)
assert.equal(
  formatCourseWeeks([12, 11, 9, 6, 4, 2, 1, 1]),
  '第 1-2 周、4-6 周（双）、9-11 周（单）、12 周',
  '周次应先去重排序，再分别合并连续、单双周区间',
)
assert.equal(formatCourseWeeks([]), '未设置', '空周次应显示兜底文案')

assert.equal(
  resolveHorizontalSwipeWeek(3, 20, { x: 240, y: 120 }, { x: 160, y: 124 }),
  4,
  '左滑应切换到下一周',
)
assert.equal(
  resolveHorizontalSwipeWeek(3, 20, { x: 160, y: 120 }, { x: 240, y: 124 }),
  2,
  '右滑应切换到上一周',
)
assert.equal(
  resolveHorizontalSwipeWeek(3, 20, { x: 240, y: 120 }, { x: 200, y: 180 }),
  3,
  '纵向滑动不应切换周次',
)
assert.equal(
  resolveHorizontalSwipeWeek(1, 20, { x: 160, y: 120 }, { x: 240, y: 124 }),
  1,
  '第一周右滑不应越界',
)
assert.equal(
  resolveHorizontalSwipeWeek(20, 20, { x: 240, y: 120 }, { x: 160, y: 124 }),
  20,
  '最后一周左滑不应越界',
)
assert.match(
  schedulePageSource,
  /onTouchStart=\{handleWeekTouchStart\}[\s\S]*?onTouchEnd=\{handleWeekTouchEnd\}/u,
  '周课表网格必须接入左右滑动手势',
)

process.stdout.write('academic schedule isolation smoke: ok\n')
