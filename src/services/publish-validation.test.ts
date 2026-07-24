import { describe, expect, it, vi } from 'vitest'
import { emptyForms } from './publish'
import { validatePublish } from './publish-validation'

vi.mock('../api/generated/client', () => ({}))

describe('publish validation', () => {
  it('requires the campus-circle section and text fields', () => {
    expect(validatePublish({ type: 'campus-circle', form: { ...emptyForms['campus-circle'] } })).toMatchObject({
      section_id: '请选择子模块',
      title: '请填写标题',
      content: '请填写正文'
    })
  })

  it('validates activity time order and capacity', () => {
    const form = { ...emptyForms.activity, title: '活动', summary: '简介', body: '正文', location: '礼堂', contact: 'wx-id', capacity: '0', signup_start_at: '2026-08-02 10:00', signup_end_at: '2026-08-01 10:00', start_at: '2026-08-03 10:00', end_at: '2026-08-03 09:00' }
    expect(validatePublish({ type: 'activity', form })).toMatchObject({
      capacity: '人数至少为 1',
      signup_end_at: '报名结束时间须晚于开始时间',
      end_at: '活动结束时间须晚于开始时间'
    })
  })

  it('enforces positive amounts, seats, and valid contact details', () => {
    expect(validatePublish({ type: 'marketplace', form: { ...emptyForms.marketplace, title: '教材', description: '旧书', price: '0', contact: '?' } })).toMatchObject({ price: '价格必须大于 0', contact: '联系方式格式不正确' })
    expect(validatePublish({ type: 'carpool', form: { ...emptyForms.carpool, title: '拼车', origin: '学校', destination: '车站', departure_at: '2026-08-01 08:00', total_seats: '0', contact: 'wx-id' } })).toMatchObject({ total_seats: '座位数至少为 1' })
  })
})
