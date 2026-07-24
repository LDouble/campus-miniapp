import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyForms, loadCampusCircleSections, localTimeToISO, submitPublish, yuanToCents } from './publish'

const clients = vi.hoisted(() => ({
  createActivity: vi.fn(),
  createCampusCirclePost: vi.fn(),
  createCarpoolTrip: vi.fn(),
  createErrand: vi.fn(),
  createMarketplaceListing: vi.fn(),
  listCampusCircleSections: vi.fn(),
  submitActivityReview: vi.fn(),
  submitMarketplaceListing: vi.fn()
}))

vi.mock('../api/generated/client', () => clients)

const view = (id: number, version: number) => ({ data: { id, version } })

describe('publish orchestration', () => {
  beforeEach(() => {
    Object.values(clients).forEach(mock => mock.mockReset())
  })

  it('converts yuan and local time deterministically', () => {
    expect(yuanToCents('12.34')).toBe(1234)
    expect(localTimeToISO('2026-08-01 09:30')).toBe('2026-08-01T01:30:00.000Z')
  })

  it('creates and submits an activity with the returned version', async () => {
    clients.createActivity.mockResolvedValue(view(11, 3))
    clients.submitActivityReview.mockResolvedValue(view(11, 4))
    const form = { ...emptyForms.activity, title: '社团开放日', summary: '简介', body: '正文', location: '礼堂', signup_start_at: '2026-08-01 09:00', signup_end_at: '2026-08-02 09:00', start_at: '2026-08-03 09:00', end_at: '2026-08-03 11:00', capacity: '20', contact: 'campus-user' }
    await expect(submitPublish({ type: 'activity', form })).resolves.toEqual({ id: 11, type: 'activity', version: 4 })
    expect(clients.createActivity).toHaveBeenCalledWith(expect.objectContaining({ capacity: 20, start_at: '2026-08-03T01:00:00.000Z' }))
    expect(clients.submitActivityReview).toHaveBeenCalledWith(11, { expected_version: 3 })
  })

  it('creates a campus-circle post directly in review without a second request', async () => {
    clients.createCampusCirclePost.mockResolvedValue(view(12, 1))
    await expect(submitPublish({ type: 'campus-circle', form: { ...emptyForms['campus-circle'], section_id: 5, title: '失物', content: '捡到校园卡' } })).resolves.toEqual({ id: 12, type: 'campus-circle', version: 1 })
    expect(clients.createCampusCirclePost).toHaveBeenCalledWith(expect.objectContaining({ section_id: 5, image_urls: [] }))
    expect(clients.submitActivityReview).not.toHaveBeenCalled()
  })

  it('only exposes active leaf campus-circle sections', async () => {
    clients.listCampusCircleSections.mockResolvedValue({
      data: {
        items: [
          { id: 1, parent_id: null, status: 'active', children: [{ id: 2, parent_id: 1, status: 'active', children: [], name: '失物招领' }], name: '父模块' },
          { id: 3, parent_id: null, status: 'active', children: [], name: '无子模块的根节点' },
          { id: 4, parent_id: 1, status: 'archived', children: [], name: '已停用' }
        ]
      }
    })
    await expect(loadCampusCircleSections()).resolves.toEqual([expect.objectContaining({ id: 2, name: '失物招领' })])
  })

  it('maps marketplace price and submits the created listing', async () => {
    clients.createMarketplaceListing.mockResolvedValue(view(13, 2))
    clients.submitMarketplaceListing.mockResolvedValue({ data: { updated: true } })
    await submitPublish({ type: 'marketplace', form: { ...emptyForms.marketplace, title: '教材', description: '九成新', price: '25.50', contact: 'wx-id' } })
    expect(clients.createMarketplaceListing).toHaveBeenCalledWith(expect.objectContaining({ price_cents: 2550, image_urls: [] }))
    expect(clients.submitMarketplaceListing).toHaveBeenCalledWith(13, { expected_version: 2 })
  })

  it('maps errands and carpools whose create operations directly enter review', async () => {
    clients.createErrand.mockResolvedValue(view(14, 1))
    clients.createCarpoolTrip.mockResolvedValue(view(15, 6))
    await expect(submitPublish({ type: 'errand', form: { ...emptyForms.errand, title: '取快递', description: '东门', reward: '3', pickup_location: '驿站', dropoff_location: '宿舍', deadline: '2026-08-01 18:00', contact: 'wx-id' } })).resolves.toEqual({ id: 14, type: 'errand', version: 1 })
    await expect(submitPublish({ type: 'carpool', form: { ...emptyForms.carpool, title: '去机场', origin: '学校', destination: '机场', departure_at: '2026-08-01 08:00', total_seats: '3', contact: 'wx-id' } })).resolves.toEqual({ id: 15, type: 'carpool', version: 6 })
    expect(clients.createErrand).toHaveBeenCalledWith(expect.objectContaining({ reward_cents: 300 }))
    expect(clients.createCarpoolTrip).toHaveBeenCalledWith(expect.objectContaining({ total_seats: 3 }))
  })

  it('does not submit review when creation fails', async () => {
    clients.createErrand.mockRejectedValue(new Error('network error'))
    await expect(submitPublish({ type: 'errand', form: { ...emptyForms.errand, deadline: '2026-08-01 18:00' } })).rejects.toThrow('network error')
    expect(clients.createCarpoolTrip).not.toHaveBeenCalled()
  })
})
