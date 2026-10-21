import { strict as assert } from 'node:assert'
import { createMemberAdFrequency } from '../src/features/member-ad-popup/frequency'
import { MEMBER_AD_INTERVAL_MS } from '../src/features/member-ad-popup/policy'

let now = 1_800_000_000_000
const records = new Map<string, unknown>()
const writes: Array<{ key: string; value: number }> = []
const storage = {
  getStorageSync: (key: string) => records.get(key) ?? '',
  setStorageSync: (key: string, value: number) => { records.set(key, value); writes.push({ key, value }) },
}
const frequency = createMemberAdFrequency(storage, () => now)
assert.equal(frequency.isDue(1, ['member']), true)
assert.equal(frequency.isDue(1, ['member']), true)
assert.equal(writes.length, 0, '资格检查和准备阶段不得消耗频控')
assert.equal(frequency.isDue(1, ['guest']), false)
assert.equal(frequency.recordShown(1), true)
assert.equal(writes.length, 1)
assert.equal(writes[0].value, now)
assert.equal(frequency.isDue(1, ['member']), false)
assert.equal(frequency.isDue(2, ['member']), true, '账号频控互相隔离')
const restarted = createMemberAdFrequency(storage, () => now)
assert.equal(restarted.isDue(1, ['member']), false, '重新打开页面或应用后仍读取已展示时间')
now += MEMBER_AD_INTERVAL_MS - 1
assert.equal(frequency.isDue(1, ['member']), false)
now++
assert.equal(frequency.isDue(1, ['member']), true)
records.set('campus.member-ad-popup.v1.2', now + 1000)
assert.equal(frequency.isDue(2, ['member']), false, '时钟回拨不得重新展示')
records.set('campus.member-ad-popup.v1.2', 'bad-record')
assert.equal(frequency.isDue(2, ['member']), false)
assert.equal(frequency.recordShown(0), false)
assert.equal(writes.length, 1)
const readFailure = createMemberAdFrequency({ ...storage, getStorageSync: () => { throw new Error('read') } }, () => now)
assert.equal(readFailure.isDue(3, ['member']), false)
const writeFailure = createMemberAdFrequency({
  getStorageSync: () => '',
  setStorageSync: () => { throw new Error('write') },
}, () => now)
assert.equal(writeFailure.isDue(3, ['member']), true)
assert.equal(writeFailure.recordShown(3), false)
assert.equal(writeFailure.isDue(3, ['member']), false, '持久化失败时，实际展示仍进入运行期冷却')
console.log('广告三天频控：准备不扣减、实际展示、账号隔离、重启、72小时边界及存储异常检查通过')
