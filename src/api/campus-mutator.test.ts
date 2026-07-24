import { beforeEach, describe, expect, it, vi } from 'vitest'
import { campusRequest, createIdempotencyKey } from './campus-mutator'

const mocks = vi.hoisted(() => {
  const storage = new Map<string, string>()
  return {
    storage,
    request: vi.fn(),
    removeStorageSync: vi.fn((key: string) => storage.delete(key))
  }
})

vi.mock('@tarojs/taro', () => ({
  default: {
    getStorageSync: (key: string) => mocks.storage.get(key) || '',
    setStorageSync: (key: string, value: string) => mocks.storage.set(key, value),
    removeStorageSync: mocks.removeStorageSync,
    request: mocks.request
  }
}))

describe('campusRequest', () => {
  beforeEach(() => {
    mocks.storage.clear()
    mocks.storage.set('access_token', 'old-access')
    mocks.storage.set('refresh_token', 'old-refresh')
    mocks.request.mockReset()
    mocks.removeStorageSync.mockClear()
  })

  it('generates bounded unique idempotency keys', () => {
    const first = createIdempotencyKey()
    const second = createIdempotencyKey()
    expect(first).not.toBe(second)
    expect(first.length).toBeLessThanOrEqual(128)
  })

  it('adds an idempotency key to authenticated writes', async () => {
    mocks.request.mockResolvedValue({ statusCode: 201, data: { id: 1 } })
    await campusRequest({ url: '/api/v1/activities', method: 'POST', data: {} })
    expect(mocks.request.mock.calls[0][0].header['Idempotency-Key']).toMatch(/^miniapp-/)
  })

  it('refreshes once and reuses the original idempotency key when replaying', async () => {
    mocks.request
      .mockResolvedValueOnce({ statusCode: 401, data: { error: { message: 'expired' } } })
      .mockResolvedValueOnce({ statusCode: 200, data: { data: { access_token: 'new-access', refresh_token: 'new-refresh' } } })
      .mockResolvedValueOnce({ statusCode: 201, data: { id: 2 } })

    await campusRequest({ url: '/api/v1/activities', method: 'POST', data: {} })

    expect(mocks.request).toHaveBeenCalledTimes(3)
    expect(mocks.request.mock.calls[0][0].header['Idempotency-Key']).toBe(mocks.request.mock.calls[2][0].header['Idempotency-Key'])
    expect(mocks.request.mock.calls[2][0].header.Authorization).toBe('Bearer new-access')
  })

  it('merges concurrent token refreshes', async () => {
    let finishRefresh: (value: unknown) => void = () => undefined
    const refreshResponse = new Promise(resolve => { finishRefresh = resolve })
    let initialRequests = 0
    mocks.request.mockImplementation(({ url, header }) => {
      if (url.endsWith('/auth/refresh')) return refreshResponse
      if (header.Authorization === 'Bearer old-access') {
        initialRequests += 1
        return Promise.resolve({ statusCode: 401, data: {} })
      }
      return Promise.resolve({ statusCode: 200, data: { ok: true } })
    })
    const first = campusRequest({ url: '/api/v1/activities/mine', method: 'GET' })
    const second = campusRequest({ url: '/api/v1/errands/mine', method: 'GET' })
    await vi.waitFor(() => expect(initialRequests).toBe(2))
    finishRefresh({ statusCode: 200, data: { data: { access_token: 'new-access', refresh_token: 'new-refresh' } } })
    await Promise.all([first, second])
    expect(mocks.request.mock.calls.filter(([options]) => options.url.endsWith('/auth/refresh'))).toHaveLength(1)
  })

  it('clears login state when refreshing fails', async () => {
    mocks.request
      .mockResolvedValueOnce({ statusCode: 401, data: {} })
      .mockResolvedValueOnce({ statusCode: 401, data: { error: { message: 'refresh expired' } } })
    await expect(campusRequest({ url: '/api/v1/activities/mine', method: 'GET' })).rejects.toThrow('refresh expired')
    expect(mocks.storage.has('access_token')).toBe(false)
    expect(mocks.storage.has('refresh_token')).toBe(false)
  })
})
