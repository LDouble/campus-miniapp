import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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

const persistentContactCases = [
  { resourceType: 'marketplace', page: 'marketplace' },
  { resourceType: 'errand', page: 'errands' },
  { resourceType: 'carpool', page: 'carpool' },
]

for (const item of persistentContactCases) {
  const source = readFileSync(
    resolve(__dirname, `../src/pages/${item.page}/detail.tsx`),
    'utf8',
  )
  assert.match(
    source,
    new RegExp(`hasParticipationContactAccess\\('${item.resourceType}',\\s*item\\.viewer_relation,\\s*item\\.status\\)`),
    `${item.resourceType}: 常驻联系条必须按 viewer_relation 和状态判断访问权限`,
  )
  assert.match(
    source,
    /persistentContact=\{persistentContact\}/u,
    `${item.resourceType}: 详情页必须把已解锁联系方式传入固定操作区`,
  )
}

const commentsSource = readFileSync(
  resolve(__dirname, '../src/features/life-services/components/detail-comments.tsx'),
  'utf8',
)
assert.match(
  commentsSource,
  /business-detail-composer__persistent-contact/u,
  '评论操作区必须渲染常驻联系条',
)

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

  const revisitCases = [
    {
      resourceType: 'marketplace' as const,
      resourceId: 17,
      viewerRelation: 'buyer',
      activeStatus: 'reserved',
      terminalStatus: 'sold',
      contact: 'market-campus',
    },
    {
      resourceType: 'errand' as const,
      resourceId: 18,
      viewerRelation: 'runner',
      activeStatus: 'accepted',
      terminalStatus: 'completed',
      contact: 'runner-campus',
    },
    {
      resourceType: 'carpool' as const,
      resourceId: 19,
      viewerRelation: 'participant',
      activeStatus: 'full',
      terminalStatus: 'completed',
      contact: 'carpool-campus',
    },
  ]

  for (const revisitCase of revisitCases) {
    const firstReveal = await restoreParticipationContact(storage, getIdentity, {
      resourceType: revisitCase.resourceType,
      resourceId: revisitCase.resourceId,
      viewerRelation: revisitCase.viewerRelation,
      resourceStatus: revisitCase.activeStatus,
      contactType: 'wechat',
      contact: revisitCase.contact,
    })
    assert.deepEqual(firstReveal, {
      contactType: 'wechat',
      contact: revisitCase.contact,
    })
    assert.deepEqual(
      participationContactStorage.read(
        storage,
        42,
        revisitCase.resourceType,
        revisitCase.resourceId,
      ),
      firstReveal,
    )
    assert.equal(
      participationContactStorage.read(
        storage,
        43,
        revisitCase.resourceType,
        revisitCase.resourceId,
      ),
      null,
    )

    const revisit = await restoreParticipationContact(storage, getIdentity, {
      resourceType: revisitCase.resourceType,
      resourceId: revisitCase.resourceId,
      viewerRelation: revisitCase.viewerRelation,
      resourceStatus: revisitCase.activeStatus,
      contactType: 'wechat',
      contact: 'c************',
    })
    assert.deepEqual(revisit, firstReveal)
    assert.deepEqual(
      visibleParticipationContact('wechat', 'c************', revisit),
      firstReveal,
    )

    assert.equal(await restoreParticipationContact(storage, getIdentity, {
      resourceType: revisitCase.resourceType,
      resourceId: revisitCase.resourceId,
      viewerRelation: revisitCase.viewerRelation,
      resourceStatus: revisitCase.terminalStatus,
      contactType: 'wechat',
      contact: 'c************',
    }), null)
    assert.equal(
      participationContactStorage.read(
        storage,
        42,
        revisitCase.resourceType,
        revisitCase.resourceId,
      ),
      null,
    )
  }

  assert.deepEqual(
    visibleParticipationContact('phone', '13800138000', {
      contactType: 'wechat',
      contact: 'cached-campus',
    }),
    { contactType: 'phone', contact: '13800138000' },
  )

  console.log('contact reveal smoke passed')
}

void main()
