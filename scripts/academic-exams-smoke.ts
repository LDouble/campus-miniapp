import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  resolveDefaultPeriodId,
} from '../src/pages/academic/utils'
import type { AcademicPeriod } from '../src/pages/academic/types'

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
