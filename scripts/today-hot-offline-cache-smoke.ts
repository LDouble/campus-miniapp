import { strict as assert } from 'node:assert'
import * as fs from 'node:fs'
import Module = require('node:module')
import * as path from 'node:path'

const root = path.resolve(__dirname, '..')
const entry = fs.readFileSync(path.join(root, 'src/features/today-hot/home-entry.tsx'), 'utf8')
const cache = fs.readFileSync(path.join(root, 'src/features/today-hot/home-cache.ts'), 'utf8')

assert.match(entry, /readTodayHotHomeSnapshot/, '组件挂载时必须同步恢复热聊缓存')
assert.match(entry, /writeTodayHotHomeSnapshot/, '热聊成功响应必须写入持久化缓存')
assert.doesNotMatch(entry, /catch\s*\{\s*setHome\(/, '请求失败不能清空已恢复或已展示的热聊内容')
assert.match(entry, /requestId !== requestSequence\.current \|\| scope !== getPageCacheScope\(\)/, '旧请求不得覆盖新账号作用域')
assert.match(cache, /\$\{getPageCacheScope\(\)\}:today-hot:home:\$\{campus\}/, '缓存键必须包含账号和校区作用域')
assert.match(cache, /value\.items\.length <= 30/, '缓存读取必须限制帖子上限')
assert.match(cache, /value\.items\.every\(isTodayHotEntry\)/, '缓存读取必须校验渲染字段')

const values = new Map<string, unknown>([
  ['campus.pageSession.v1:https://cache.example', {
    version: 1,
    generation: 3,
    user: { id: 41, username: '甲同学', avatar_url: '' },
  }],
])
const taro = {
  getStorageSync<T>(key: string) { return values.get(key) as T },
  setStorageSync<T>(key: string, value: T) { values.set(key, value) },
  getAccountInfoSync() { return { miniProgram: { envVersion: 'develop' } } },
}
;(global as typeof globalThis & {
  __CAMPUS_REVIEW_API_BASE_URL__: string
  __CAMPUS_PRODUCTION_API_BASE_URL__: string
}).__CAMPUS_REVIEW_API_BASE_URL__ = ''
;(global as typeof globalThis & {
  __CAMPUS_REVIEW_API_BASE_URL__: string
  __CAMPUS_PRODUCTION_API_BASE_URL__: string
}).__CAMPUS_PRODUCTION_API_BASE_URL__ = ''
const loader = Module as unknown as { _load: (...args: any[]) => any }
const originalLoad = loader._load
loader._load = function (name, ...args) {
  if (name === '@tarojs/taro') return { default: taro }
  if (name === '../api/environment') return { resolveApiBaseUrl: () => 'https://cache.example' }
  if (name === '../runtime-config') {
    return { getMiniappRuntimeConfig: () => ({}), getSelectedCampus: () => 'main' }
  }
  return originalLoad.call(this, name, ...args)
}
const {
  readTodayHotHomeSnapshot,
  todayHotHomeCacheKey,
  writeTodayHotHomeSnapshot,
} = require('../src/features/today-hot/home-cache') as typeof import('../src/features/today-hot/home-cache')
const { saveCachedPageUser } = require('../src/state/page-cache') as typeof import('../src/state/page-cache')
loader._load = originalLoad

const cacheKey = todayHotHomeCacheKey()
const cached = {
  enabled: true,
  snapshotId: 8,
  intervalSeconds: 5,
  items: [{ post_id: 7, content: '本地热聊', images: [] }],
} as any
writeTodayHotHomeSnapshot(cacheKey, cached)
assert.equal(readTodayHotHomeSnapshot().items[0]?.post_id, 7, '网络不可用前应同步恢复缓存内容')
writeTodayHotHomeSnapshot(cacheKey, { ...cached, items: Array.from({ length: 31 }, () => cached.items[0]) })
assert.equal(readTodayHotHomeSnapshot().items.length, 1, '超过上限的损坏快照不能覆盖有效缓存')
saveCachedPageUser({ id: 84 })
writeTodayHotHomeSnapshot(cacheKey, cached)
assert.equal(readTodayHotHomeSnapshot().items.length, 0, '账号切换后旧作用域响应不能写入新缓存')
process.stdout.write('today hot offline cache regression smoke: ok\n')
