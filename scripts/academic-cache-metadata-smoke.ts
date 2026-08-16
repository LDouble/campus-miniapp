import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { resolveAcademicCacheNotice } from '../src/pages/academic/components/academic-cache-notice'

const now = Date.parse('2026-08-16T14:27:00+08:00')

assert.deepEqual(
  resolveAcademicCacheNotice({
    state: 'fresh',
    cached_at: '2026-08-16T14:25:00+08:00',
    fresh_until: '2026-08-16T14:30:00+08:00',
  }, 0, now),
  {
    kind: 'fresh',
    message: '数据缓存于 08/16 14:25，预计 08/16 14:30 后可更新',
    refreshAt: Date.parse('2026-08-16T14:30:00+08:00'),
  },
  'Fresh 缓存应说明快照时间与可由用户触发刷新的时间',
)

assert.deepEqual(
  resolveAcademicCacheNotice({
    state: 'fresh',
    cached_at: '2026-08-16T14:25:00+08:00',
    fresh_until: '2026-08-16T14:20:00+08:00',
  }, 0, now),
  {
    kind: 'fresh',
    message: '数据缓存于 08/16 14:25，现可下拉更新',
  },
  'Fresh 到期后只能改变提示文案，不能暗示自动发起请求',
)

assert.deepEqual(
  resolveAcademicCacheNotice({
    state: 'stale',
    cached_at: '2026-08-16T14:10:00+08:00',
  }, 0, now),
  {
    kind: 'stale',
    message: '数据缓存于 08/16 14:10，当前为兜底数据，下拉更新',
  },
  '服务端 Stale 必须提示用户主动下拉更新',
)

assert.deepEqual(
  resolveAcademicCacheNotice(
    undefined,
    Date.parse('2026-08-16T14:10:00+08:00'),
    now,
    true,
  ),
  {
    kind: 'local',
    message: '教务暂不可用，展示本机保存于 08/16 14:10 的数据，下拉重试',
  },
  '本机离线缓存不能伪装成服务端 Stale',
)

assert.deepEqual(
  resolveAcademicCacheNotice(undefined, Date.parse('2026-08-16T14:10:00+08:00'), now),
  {
    kind: 'local',
    message: '展示本机保存于 08/16 14:10 的数据，正在更新',
  },
  '本机初始缓存不应在尚未失败时误报教务不可用',
)

assert.equal(
  resolveAcademicCacheNotice({ state: 'fresh', cached_at: 'invalid' }, 0, now),
  null,
  '非法服务端时间不得显示 Invalid Date',
)

const gradesPage = readFileSync(resolve(__dirname, '../src/pages/academic/grades/index.tsx'), 'utf8')
assert.ok(
  gradesPage.includes('setLoading(!hasInitialSnapshot)'),
  '已有本机成绩快照时应继续展示数据并在后台刷新',
)

const schedulePage = readFileSync(resolve(__dirname, '../src/pages/academic/schedule/index.tsx'), 'utf8')
assert.ok(
  schedulePage.includes('currentCache?.coursesUpdatedAtByPeriod || {}')
    && schedulePage.includes('coursesUpdatedAtByPeriod[periodId]'),
  '课程快照时间必须按学期保存，且仅更新学期列表时不得覆盖',
)

process.stdout.write('academic cache metadata smoke: ok\n')
