import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildDailyCheckinCalendar,
  checkinMonthRange,
  isCheckinMonthAvailable,
  monthFromServerDate,
  shiftCheckinMonth,
} from '../src/features/daily-checkin/calendar'

assert.equal(monthFromServerDate('2026-08-10'), '2026-08')
assert.equal(monthFromServerDate('invalid'), '')
assert.equal(shiftCheckinMonth('2026-01', -1), '2025-12')
assert.equal(shiftCheckinMonth('2025-12', 2), '2026-02')
assert.deepEqual(checkinMonthRange('2026-08-10'), {
  earliest: '2025-08',
  latest: '2026-08',
})
assert.equal(isCheckinMonthAvailable('2025-08', '2026-08-10'), true)
assert.equal(isCheckinMonthAvailable('2025-07', '2026-08-10'), false)
assert.equal(isCheckinMonthAvailable('2026-09', '2026-08-10'), false)

const leapYearCalendar = buildDailyCheckinCalendar('2024-02', [
  { date: '2024-02-29', checked_in_at: '2024-02-29T08:00:00+08:00', reward: 10 },
], '2024-02-29')
assert.equal(leapYearCalendar.length, 35)
assert.equal(leapYearCalendar.slice(0, 4).every((cell) => cell.date === null), true)
assert.equal(leapYearCalendar[4].date, '2024-02-01')
assert.deepEqual(
  leapYearCalendar.find((cell) => cell.date === '2024-02-29'),
  {
    key: '2024-02-29',
    date: '2024-02-29',
    day: 29,
    checkedIn: true,
    reward: 10,
    isServerDate: true,
    isFuture: false,
  },
)

const currentMonthCalendar = buildDailyCheckinCalendar('2026-08', [], '2026-08-10')
assert.equal(currentMonthCalendar.find((cell) => cell.date === '2026-08-11')?.isFuture, true)
assert.equal(currentMonthCalendar.find((cell) => cell.date === '2026-08-09')?.isFuture, false)

const appConfig = readFileSync(resolve(__dirname, '../src/app.config.ts'), 'utf8')
const profilePage = readFileSync(resolve(__dirname, '../src/pages/profile/index.tsx'), 'utf8')
const userLevelPage = readFileSync(resolve(__dirname, '../src/pages/user-level/index.tsx'), 'utf8')
const checkinPage = readFileSync(resolve(__dirname, '../src/pages/daily-checkin/index.tsx'), 'utf8')
const api = readFileSync(resolve(__dirname, '../src/api/daily-checkins.ts'), 'utf8')

assert.ok(appConfig.includes("'pages/daily-checkin/index'"), '签到页必须注册到完整页面集合')
assert.equal(
  /qualificationExcludedPages[\s\S]*pages\/daily-checkin\/index/u.test(appConfig),
  false,
  '资格版不得排除签到页',
)
assert.ok(profilePage.includes("'/pages/daily-checkin/index'"), '“我的”页面缺少签到入口')
assert.ok(userLevelPage.includes("'/pages/daily-checkin/index'"), '用户等级页缺少签到入口')
assert.ok(userLevelPage.includes("daily_checkin: '每日签到'"), '经验流水缺少每日签到文案')
assert.ok(api.includes("path: '/api/v1/checkins/me/status'"), '缺少签到状态 API')
assert.ok(api.includes("path: '/api/v1/checkins/me/history'"), '缺少签到历史 API')
assert.ok(api.includes("path: '/api/v1/checkins'"), '缺少签到写入 API')
assert.ok(checkinPage.includes('usePullDownRefresh'), '签到页缺少下拉刷新')
assert.ok(checkinPage.includes('submitting'), '签到页缺少提交中状态')
assert.ok(checkinPage.includes('already_checked_in'), '签到页缺少重复签到反馈')
assert.ok(checkinPage.includes('点击重试'), '签到页缺少失败重试入口')
assert.ok(checkinPage.includes('status.checked_in'), '签到页缺少已签到状态')

process.stdout.write('daily check-in semantic smoke: ok\n')
