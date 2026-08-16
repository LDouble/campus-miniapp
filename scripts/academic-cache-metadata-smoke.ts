import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { resolveAcademicCacheNotice } from '../src/pages/academic/components/academic-cache-notice'

const now = Date.parse('2026-08-16T14:27:00+08:00')

assert.deepEqual(
  resolveAcademicCacheNotice({
    cache: {
      state: 'fresh',
      cached_at: '2026-08-16T14:25:00+08:00',
      fresh_until: '2026-08-16T14:30:00+08:00',
    },
    now,
  }),
  {
    kind: 'fresh',
    message: '数据缓存于 08/16 14:25，08/16 14:30 后可下拉刷新',
    refreshAt: Date.parse('2026-08-16T14:30:00+08:00'),
  },
  'Fresh 缓存应说明快照时间与可由用户触发刷新的时间',
)

assert.deepEqual(
  resolveAcademicCacheNotice({
    cache: {
      state: 'fresh',
      cached_at: '2026-08-16T14:25:00+08:00',
      fresh_until: '2026-08-16T14:20:00+08:00',
    },
    now,
  }),
  {
    kind: 'fresh',
    message: '数据缓存于 08/16 14:25，现可下拉刷新',
  },
  'Fresh 到期后只能改变提示文案，不能暗示自动发起请求',
)

assert.deepEqual(
  resolveAcademicCacheNotice({
    cache: {
      state: 'stale',
      cached_at: '2026-08-16T14:10:00+08:00',
    },
    now,
  }),
  {
    kind: 'stale',
    message: '数据缓存于 08/16 14:10，当前为兜底数据，下拉重试',
  },
  '服务端 Stale 必须提示用户主动下拉更新',
)

assert.deepEqual(
  resolveAcademicCacheNotice({
    localUpdatedAt: Date.parse('2026-08-16T14:10:00+08:00'),
    now,
    localFallback: true,
  }),
  {
    kind: 'local',
    message: '教务暂不可用，展示本机保存于 08/16 14:10 的数据，下拉重试',
  },
  '本机离线缓存不能伪装成服务端 Stale',
)

assert.deepEqual(
  resolveAcademicCacheNotice({ updatedAt: now, now }),
  {
    kind: 'updated',
    message: '更新时间：08/16 14:27',
  },
  '成功响应缺少 cache 时应显示本次成功时间',
)

assert.equal(
  resolveAcademicCacheNotice({
    cache: { state: 'fresh', cached_at: 'invalid' },
    now,
  }),
  null,
  '非法服务端时间不得显示 Invalid Date',
)

assert.equal(
  resolveAcademicCacheNotice({
    localUpdatedAt: Date.parse('2026-08-16T14:10:00+08:00'),
    now,
  }),
  null,
  '请求尚未失败时不应把本机快照显示成更新时间',
)

assert.deepEqual(
  resolveAcademicCacheNotice({
    localUpdatedAt: Math.floor(Date.parse('2026-08-16T14:10:00+08:00') / 1000),
    localFallback: true,
    now,
  }),
  {
    kind: 'local',
    message: '教务暂不可用，展示本机保存于 08/16 14:10 的数据，下拉重试',
  },
  '合理的秒级本机时间戳应兼容为毫秒时间',
)

for (const invalidTimestamp of [0, 1, Number.NaN, Number.POSITIVE_INFINITY, now + 10 * 60 * 1000]) {
  assert.equal(
    resolveAcademicCacheNotice({
      localUpdatedAt: invalidTimestamp,
      localFallback: true,
      now,
    }),
    null,
    `异常本机时间 ${invalidTimestamp} 不得生成缓存提示`,
  )
}

const gradesPage = readFileSync(resolve(__dirname, '../src/pages/academic/grades/index.tsx'), 'utf8')
assert.ok(
  gradesPage.includes('setLoading(!hasInitialSnapshot)'),
  '已有本机成绩快照时应继续展示数据并在后台刷新',
)

for (const pagePath of [
  '../src/pages/academic/schedule/index.tsx',
  '../src/pages/academic/grades/index.tsx',
  '../src/pages/academic/exams/index.tsx',
  '../src/pages/academic/selection/index.tsx',
]) {
  const page = readFileSync(resolve(__dirname, pagePath), 'utf8')
  assert.ok(
    page.includes('updatedAt={!usingCache && !loadError ? cacheUpdatedAt : 0}'),
    `${pagePath} 应在成功后展示本次更新时间`,
  )
  assert.ok(
    page.includes('localUpdatedAt={usingCache ? cacheUpdatedAt : 0}')
      && page.includes('localFallback={Boolean(loadError)}'),
    `${pagePath} 应仅在请求失败回退时展示本机快照时间`,
  )
}

const schedulePage = readFileSync(resolve(__dirname, '../src/pages/academic/schedule/index.tsx'), 'utf8')
assert.ok(
  schedulePage.includes('currentCache?.coursesUpdatedAtByPeriod || {}')
    && schedulePage.includes('coursesUpdatedAtByPeriod[periodId]'),
  '课程快照时间必须按学期保存，且仅更新学期列表时不得覆盖',
)

process.stdout.write('academic cache metadata smoke: ok\n')
