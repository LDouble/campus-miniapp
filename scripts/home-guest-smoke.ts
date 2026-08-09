import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getAcademicCalendarLabel } from '../src/pages/academic/utils'
import type { AcademicPeriod } from '../src/pages/academic/types'

const homeSource = readFileSync(
  resolve(__dirname, '../src/pages/index/index.tsx'),
  'utf8',
)

assert.ok(
  homeSource.includes('getAcademicVerificationStatus()'),
  '首页刷新教务数据前必须先查询校园身份认证状态',
)
assert.ok(
  homeSource.includes("verification.value.identity?.status !== 'verified'"),
  '首页必须让未认证用户直接使用缓存',
)
assert.ok(
  homeSource.includes('academicStorage.getScheduleCache(')
    && homeSource.includes('account.ok ? account.value.user.id : getActiveAcademicUserId()'),
  '首页课表预览应仅使用当前用户的本地缓存',
)
assert.ok(
  homeSource.includes('!hasCachedCourses && hasCredential'),
  '首页只有持有当前用户教务凭据时才可刷新课程，避免自动跳转重新绑定',
)
assert.ok(
  homeSource.includes('getAcademicCalendarLabel(latestAcademic?.periods || [])'),
  '首页标签必须与课表卡片使用同一次教务学期结果',
)
assert.ok(
  !homeSource.includes('loadAcademicCalendar('),
  '首页标签不得再混用公共校历数据源',
)

const periods: AcademicPeriod[] = [{
  id: '2026-autumn',
  label: '2026-2027 学年秋季学期',
  shortLabel: '26秋',
  startDate: '2026-08-31',
  weeks: 18,
  isCurrent: true,
}]
assert.equal(
  getAcademicCalendarLabel(periods, new Date('2026/08/09 12:00:00')),
  '8月31日开学',
)
assert.equal(
  getAcademicCalendarLabel(periods, new Date('2026/09/07 12:00:00')),
  '第 2 周',
)
assert.equal(
  getAcademicCalendarLabel(periods, new Date('2027/01/10 12:00:00')),
  '本学期已结束',
)

process.stdout.write('home guest access smoke: ok\n')
