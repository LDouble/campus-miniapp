import { strict as assert } from 'node:assert'
import {
  contactTypeLabel,
  revealedContactValue,
  showParticipationContact,
} from '../src/features/life-services/contact-reveal'
import {
  hasParticipationContactAccess,
  participationContactStorage,
  restoreParticipationContact,
  visibleParticipationContact,
} from '../src/features/life-services/participation-contact-storage'

assert.equal(revealedContactValue('  wx-campus  '), 'wx-campus')
assert.equal(revealedContactValue('w********'), '')
assert.equal(revealedContactValue(''), '')
assert.equal(contactTypeLabel('wechat'), '微信')
assert.equal(contactTypeLabel('phone'), '手机号')
assert.equal(contactTypeLabel('custom'), 'custom')
assert.equal(hasParticipationContactAccess('marketplace', 'buyer', 'reserved'), true)
assert.equal(hasParticipationContactAccess('marketplace', 'seller', 'reserved'), true)
assert.equal(hasParticipationContactAccess('carpool', 'participant', 'open'), true)
assert.equal(hasParticipationContactAccess('errand', 'runner', 'accepted'), true)
assert.equal(hasParticipationContactAccess('errand', 'runner', 'completed'), false)
assert.equal(hasParticipationContactAccess('errand', 'other', 'accepted'), false)

const modals: Array<Record<string, unknown>> = []
const copied: string[] = []
const toasts: string[] = []
const platform = {
  async showModal(options: Record<string, unknown>) {
    modals.push(options)
    return { confirm: true }
  },
  async setClipboardData(options: { data: string }) {
    copied.push(options.data)
  },
  async showToast(options: { title: string }) {
    toasts.push(options.title)
  },
}

const main = async () => {
  assert.equal(await showParticipationContact(platform, {
    successTitle: '接单成功',
    contactType: 'wechat',
    contact: ' runner-campus ',
    commentStatus: 'created',
  }), true)
  assert.deepEqual(copied, ['runner-campus'])
  assert.match(String(modals[0].content), /接单成功/)
  assert.match(String(modals[0].content), /微信：runner-campus/)
  assert.match(String(modals[0].content), /已自动留言/)

  assert.equal(await showParticipationContact(platform, {
    successTitle: '预订成功',
    contactType: 'phone',
    contact: '1**********',
  }), false)
  assert.equal(modals[1].showCancel, false)
  assert.match(String(modals[1].content), /联系方式暂未同步/)
  assert.deepEqual(copied, ['runner-campus'])
  assert.deepEqual(toasts, [])

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
  const getIdentity = async () => ({ user_id: 42 })

  const firstReveal = await restoreParticipationContact(storage, getIdentity, {
    resourceType: 'errand',
    resourceId: 18,
    viewerRelation: 'runner',
    resourceStatus: 'accepted',
    contactType: 'wechat',
    contact: 'runner-campus',
  })
  assert.deepEqual(firstReveal, { contactType: 'wechat', contact: 'runner-campus' })
  assert.deepEqual(
    participationContactStorage.read(storage, 42, 'errand', 18),
    firstReveal,
  )
  assert.equal(participationContactStorage.read(storage, 43, 'errand', 18), null)

  const revisit = await restoreParticipationContact(storage, getIdentity, {
    resourceType: 'errand',
    resourceId: 18,
    viewerRelation: 'runner',
    resourceStatus: 'accepted',
    contactType: 'wechat',
    contact: 'r************',
  })
  assert.deepEqual(revisit, firstReveal)
  assert.deepEqual(
    visibleParticipationContact('wechat', 'r************', revisit),
    firstReveal,
  )
  assert.deepEqual(
    visibleParticipationContact('phone', '13800138000', revisit),
    { contactType: 'phone', contact: '13800138000' },
  )

  assert.equal(await restoreParticipationContact(storage, getIdentity, {
    resourceType: 'errand',
    resourceId: 18,
    viewerRelation: 'runner',
    resourceStatus: 'completed',
    contactType: 'wechat',
    contact: 'r************',
  }), null)
  assert.equal(participationContactStorage.read(storage, 42, 'errand', 18), null)

  console.log('contact reveal smoke passed')
}

void main()
