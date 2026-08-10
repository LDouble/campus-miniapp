import * as assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { AcademicCalendar, DailyCheckinStatus } from '../src/api/types'
import {
  resolveTodayTask,
  upcomingHomeCalendarEvents,
} from '../src/features/home/today'

const homeSource = readFileSync(
  resolve(__dirname, '../src/pages/index/index.tsx'),
  'utf8',
)

assert.match(
  homeSource,
  /const homeFeatureFlags = \{\s*todayTask: false,/,
  '今日一件事应保持默认关闭',
)
assert.ok(
  homeSource.includes('const checkinPromise = homeFeatureFlags.todayTask')
    && homeSource.includes('const tasksPromise = homeFeatureFlags.todayTask'),
  '今日一件事关闭时不得请求签到和成长任务',
)
assert.ok(
  homeSource.includes('{homeFeatureFlags.todayTask && todayTask && ('),
  '今日一件事关闭时不得渲染首页入口',
)

const calendar = {
  education_level: 'undergraduate',
  events: [
    {
      campuses: ['崂山校区'],
      description: '',
      end_date: '2026-08-12',
      homepage_recommended: true,
      id: 'selection',
      period_id: '',
      priority: 'important',
      remindable: true,
      start_date: '2026-08-12',
      title: '选课开始',
      type: 'registration',
    },
    {
      campuses: [],
      description: '',
      end_date: '2026-09-10',
      homepage_recommended: true,
      id: 'too-far',
      period_id: '',
      priority: 'normal',
      remindable: false,
      start_date: '2026-09-10',
      title: '远期事件',
      type: 'other',
    },
  ],
  refreshed_at: '2026-08-10T00:00:00Z',
  terms: [],
  timezone: 'Asia/Shanghai',
} satisfies AcademicCalendar

assert.deepEqual(
  upcomingHomeCalendarEvents(calendar, '崂山校区', new Date(2026, 7, 10)).map((item) => item.id),
  ['selection'],
)
assert.equal(
  upcomingHomeCalendarEvents(calendar, '鱼山校区', new Date(2026, 7, 10)).length,
  0,
)

const checkin = {
  checked_in: false,
  checked_in_at: null,
  consecutive_days: 2,
  enabled: true,
  next_reward: 5,
  server_date: '2026-08-10',
  timezone: 'Asia/Shanghai',
  today_reward: 5,
  user_level: {},
} as DailyCheckinStatus
assert.equal(resolveTodayTask(checkin, [])?.route, '/pages/daily-checkin/index')

console.info('today-home smoke passed')
