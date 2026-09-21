import { strict as assert } from 'node:assert'
import Module = require('node:module')

const values = new Map<string, any>()
let brokenRead = false
let brokenWrite = false
const taro = {
  getStorageSync: (key: string) => { if (brokenRead) throw new Error('read'); return values.get(key) },
  setStorageSync: (key: string, value: any) => { if (brokenWrite) throw new Error('quota'); values.set(key, JSON.parse(JSON.stringify(value))) },
  removeStorageSync: (key: string) => values.delete(key),
  getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
  showToast: () => undefined,
}
Object.assign(global, { __CAMPUS_REVIEW_API_BASE_URL__: 'https://review.example', __CAMPUS_PRODUCTION_API_BASE_URL__: 'https://production.example' })
const loader = Module as unknown as { _load: (...args: any[]) => any }
const original = loader._load
loader._load = function (name, ...args) {
  if (name === '@tarojs/taro') return { default: taro }
  return original.call(this, name, ...args)
}
const load = () => {
  delete require.cache[require.resolve('../src/state/page-cache')]
  return require('../src/state/page-cache') as typeof import('../src/state/page-cache')
}
let cache = load()
const valid = (v: unknown): v is number[] => Array.isArray(v) && v.every((n) => typeof n === 'number')
cache.saveCachedPageUser({ id: 7, username: '七', avatar_url: null })
let key = cache.getPageCacheScope() + ':home:test'
cache.writePageCache(key, [1, 2])
cache = load()
assert.equal(cache.getCachedPageUserId(), 7, '冷启动恢复身份不能等待网络')
assert.deepEqual(cache.readPageCache(key, valid), [1, 2], '进程重启后仍读取快照')
cache.writePageCache(key, [])
assert.deepEqual(cache.readPageCache(key, valid), [], '成功空数据必须覆盖旧值')
cache.writePageCache(key, { wrong: 'shape' })
assert.equal(cache.readPageCache(key, valid), null, '损坏结构不进入渲染')
cache.writePageCache(key, [1])
brokenWrite = true
assert.doesNotThrow(() => cache.writePageCache(key, [2]))
brokenWrite = false
assert.deepEqual(cache.readPageCache(key, valid), [1], '失败写入保留原快照')
brokenRead = true
assert.equal(cache.readPageCache(key, valid), null)
brokenRead = false
const aGeneration = cache.getPageSessionGeneration()
cache.saveCachedPageUser({ id: 8, username: '八' })
assert.notEqual(cache.getPageCacheScope() + ':home:test', key)
cache.saveCachedPageUser({ id: 7 }, aGeneration)
assert.equal(cache.getCachedPageUserId(), 8, '旧账号响应不能覆盖新身份')
cache.clearPageSession()
assert.equal(cache.getCachedPageUserId(), 0)
cache.saveCachedPageUser({ id: 8 }, aGeneration)
assert.equal(cache.getCachedPageUserId(), 0, '退出后的旧响应不能恢复账号')
cache = load()
assert.equal(cache.getCachedPageUserId(), 0, '退出状态跨重启保留')
const guestKey = cache.getPageCacheScope() + ':home:guest'
cache.writePageCache(guestKey, [99])
assert.equal(cache.readPageCache(guestKey, valid), null, '身份未恢复的个性化响应不得进入共同guest缓存')
cache.saveCachedPageUser({ id: 9 })
assert.equal(cache.readPageCache(key, valid), null, '不允许通过传入旧账号key绕过作用域')
key = cache.getPageCacheScope() + ':community:test:feed:x'
for (let i = 0; i < 60; i++) cache.writePageCache(key + i, [i])
const stored = values.get('campus.pageCache.v1:https://review.example')
assert.equal(stored.entries.length, 32, '缓存数量必须有界')
cache.writePageCache(key, 'x'.repeat(200_000))
assert.equal(stored.entries.length, 32)
const homeKey = cache.getPageCacheScope() + ':home:campus'
cache.writePageCache(homeKey, { feed: { items: ['old'] }, notices: ['notice'] })
const { markLifeHubSectionDirty } = require('../src/features/life-services/refresh-policy')
markLifeHubSectionDirty('community', false)
assert.ok(values.get('campus.pageCache.v1:https://review.example').entries.find((e: any) => e.key === homeKey).value.feed, '手动刷新不能先删缓存')
markLifeHubSectionDirty('community')
assert.deepEqual(values.get('campus.pageCache.v1:https://review.example').entries.find((e: any) => e.key === homeKey).value, { notices: ['notice'] }, '内容变更清理旧Feed并保留其他内容')

const { academicStorage } = require('../src/pages/academic/storage')
const custom = { id: 'custom1', periodId: 'p1', name: '自定义课程', teacher: '', location: '', weekday: 1, startSection: 1, endSection: 2, weeks: [1], color: 'blue', source: 'custom' }
academicStorage.setCustomCourses([custom], 7)
assert.deepEqual(academicStorage.getCustomCourses(7), [custom])
assert.deepEqual(academicStorage.getCustomCourses(8), [], '自定义课程不能跨账号')
values.set('academic.customCourses.v1', [custom])
values.set('campus.academicCredential.v1', { platformUserId: 9 })
assert.deepEqual(academicStorage.getCustomCourses(10), [], '未知归属不能被新账号认领')
assert.deepEqual(academicStorage.getCustomCourses(9), [custom], '已知旧账号可迁移自定义课')
assert.ok(values.has('academic.customCourses.v1'), '迁移保留原始数据')
loader._load = original
console.log('page cache smoke: ok')
