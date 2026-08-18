import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  publisherContactStorage,
  withRememberedPublisherContact,
} from '../src/features/life-services/publisher-contact-storage'

const values = new Map<string, unknown>()
const storage = {
  getStorageSync<T>(key: string) {
    return values.get(key) as T
  },
  setStorageSync<T>(key: string, value: T) {
    values.set(key, value)
  },
  removeStorageSync(key: string) {
    values.delete(key)
  },
}

assert.equal(publisherContactStorage.write(storage, 7, {
  contactType: 'wechat',
  contact: '  campus-user  ',
}), true)
assert.deepEqual(publisherContactStorage.read(storage, 7), {
  contactType: 'wechat',
  contact: 'campus-user',
})
assert.equal(publisherContactStorage.read(storage, 8), null, '联系方式应按用户隔离')

assert.deepEqual(withRememberedPublisherContact({
  contactType: 'phone' as const,
  contact: '',
  content: '新发布',
}, publisherContactStorage.read(storage, 7)), {
  contactType: 'wechat',
  contact: 'campus-user',
  content: '新发布',
})

assert.deepEqual(withRememberedPublisherContact({
  contactType: 'qq' as const,
  contact: 'draft-contact',
}, publisherContactStorage.read(storage, 7)), {
  contactType: 'qq',
  contact: 'draft-contact',
}, '已有草稿联系方式时应优先保留草稿')

assert.equal(publisherContactStorage.write(storage, 7, {
  contactType: 'phone',
  contact: '1**********',
}), false, '不应保存脱敏值')
assert.equal(publisherContactStorage.write(storage, 0, {
  contactType: 'qq',
  contact: '123456',
}), false, '无效用户不应写入')

publisherContactStorage.clear(storage, 7)
assert.equal(publisherContactStorage.read(storage, 7), null)

const publisherSource = readFileSync(
  resolve(process.cwd(), 'src/packages/social/publish/index.tsx'),
  'utf8',
)
assert.match(publisherSource, /loadRememberedContact\(\)\.then/, '新建发布页应恢复已保存联系方式')
assert.match(publisherSource, /await rememberCurrentContact\(\)/, '提交成功后应保存联系方式')
assert.match(publisherSource, /identityUserIdRef/, '联系方式存储应绑定当前用户')

console.log('publisher contact storage smoke passed')
