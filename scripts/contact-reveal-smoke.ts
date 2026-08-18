import { strict as assert } from 'node:assert'
import {
  contactTypeLabel,
  revealedContactValue,
  showParticipationContact,
} from '../src/features/life-services/contact-reveal'

assert.equal(revealedContactValue('  wx-campus  '), 'wx-campus')
assert.equal(revealedContactValue('w********'), '')
assert.equal(revealedContactValue(''), '')
assert.equal(contactTypeLabel('wechat'), '微信')
assert.equal(contactTypeLabel('phone'), '手机号')
assert.equal(contactTypeLabel('custom'), 'custom')

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

  console.log('contact reveal smoke passed')
}

void main()
