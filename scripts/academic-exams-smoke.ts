import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  formatExamCountdown,
  getExamStatusLabel,
  resolveDefaultPeriodId,
} from '../src/pages/academic/utils'
import type { AcademicPeriod, ExamRecord } from '../src/pages/academic/types'

process.env.TZ = 'UTC'

const period = (
  id: string,
  startDate: string,
  isCurrent = false,
): AcademicPeriod => ({
  id,
  label: id,
  shortLabel: id,
  startDate,
  weeks: 19,
  isCurrent,
})

const current = period('2026-2027-1', '2026/08/24', true)
const latest = period('2026-2027-2', '2026/09/21')
const previous = period('2025-2026-3', '2026/03/09')
const periods = [previous, latest, current]

assert.equal(
  resolveDefaultPeriodId(periods),
  current.id,
  '考试页默认应优先选择服务端标记的当前学期，而不是未来的最新学期',
)
assert.equal(
  resolveDefaultPeriodId([previous, latest]),
  latest.id,
  '没有当前学期时应选择开始日期最近的学期',
)

const hour = 60 * 60 * 1000
assert.equal(formatExamCountdown(30 * 60 * 1000), '1 小时后', '不足一小时应向上取整到小时')
assert.equal(formatExamCountdown(3 * hour), '3 小时后', '不足一天时应显示小时')
assert.equal(formatExamCountdown(24 * hour), '1 天后', '恰好整天时不应显示 0 小时')
assert.equal(formatExamCountdown(36 * hour), '1 天 12 小时后', '跨天倒计时应保留剩余小时')
assert.equal(formatExamCountdown(49 * hour), '2 天 1 小时后', '跨天倒计时应正确计算余数')

const exam: ExamRecord = {
  id: 'exam-1',
  periodId: current.id,
  courseName: '高等数学',
  startAt: '2026/09/02 12:00',
  endAt: '2026/09/02 14:00',
  campus: '崂山校区',
  location: '教学楼 101',
  seat: 'A01',
  phase: '期末',
  method: '闭卷',
  materials: '',
  notice: '',
}
assert.equal(
  getExamStatusLabel(exam, new Date(2026, 8, 1, 0, 0).getTime()),
  '1 天 12 小时后',
  '考试卡片应使用小时级倒计时',
)
assert.equal(
  getExamStatusLabel(exam, new Date(2026, 8, 2, 13, 0).getTime()),
  '进行中',
  '进行中的考试状态文案应保持不变',
)
assert.equal(
  getExamStatusLabel(exam, new Date(2026, 8, 2, 15, 0).getTime()),
  '已结束',
  '已结束的考试状态文案应保持不变',
)

const examPageSource = readFileSync(
  resolve(__dirname, '../src/pages/academic/exams/index.tsx'),
  'utf8',
)
assert.match(examPageSource, /resolveDefaultPeriodId/u, '考试页必须按服务端当前学期选择默认项')
assert.match(examPageSource, /getPeriods\(\{ force: true \}\)/u, '重新进入考试页必须重新同步服务端学期')
assert.match(examPageSource, /examPeriodId: ''/u, '考试学期默认值必须为空，不能固化历史学期')
assert.doesNotMatch(examPageSource, /examPeriodMode/u, '考试页不应再持久化自动/手动选择模式')
assert.match(
  examPageSource,
  /academicStorage\.setPreferences\(\{\s*\.\.\.preferences,\s*examPeriodId: '',/u,
  '考试页不能把本次历史学期选择写入本地偏好',
)
assert.match(examPageSource, /className='exam-card__label'>座位号/u, '考试卡片必须单独展示座位号')
assert.match(examPageSource, /<Text>\{exam\.location\}<\/Text>/u, '考场行只能展示考场地点')
assert.doesNotMatch(
  examPageSource,
  /exam\.location\} · \{exam\.seat/u,
  '考场行不应再拼接座位号',
)

console.log('academic exams smoke tests passed')
