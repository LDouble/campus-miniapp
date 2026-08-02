import * as assert from 'node:assert/strict'
import { test } from 'node:test'

import { requestWithAuthenticationRetry } from '../../src/features/academic-direct/session-recovery'

interface TestResponse {
  rejected: boolean
  body: string
}

test('现有 Cookie 会话有效时直接返回，不执行认证', async () => {
  let requests = 0
  let authentications = 0
  const response = await requestWithAuthenticationRetry<TestResponse>({
    request: async () => {
      requests += 1
      return { rejected: false, body: 'academic data' }
    },
    authenticate: async () => {
      authentications += 1
    },
    isRejected: (result) => result.rejected,
  })

  assert.equal(response.body, 'academic data')
  assert.equal(requests, 1)
  assert.equal(authentications, 0)
})

test('Cookie 会话失效时只认证一次并重试原请求', async () => {
  let requests = 0
  let authentications = 0
  const response = await requestWithAuthenticationRetry<TestResponse>({
    request: async () => {
      requests += 1
      return requests === 1
        ? { rejected: true, body: 'login page' }
        : { rejected: false, body: 'academic data' }
    },
    authenticate: async () => {
      authentications += 1
    },
    isRejected: (result) => result.rejected,
  })

  assert.equal(response.body, 'academic data')
  assert.equal(requests, 2)
  assert.equal(authentications, 1)
})

test('认证后仍被拒绝时返回第二次响应，由调用方统一清理会话', async () => {
  let requests = 0
  let authentications = 0
  const response = await requestWithAuthenticationRetry<TestResponse>({
    request: async () => {
      requests += 1
      return { rejected: true, body: 'login page' }
    },
    authenticate: async () => {
      authentications += 1
    },
    isRejected: (result) => result.rejected,
  })

  assert.equal(response.rejected, true)
  assert.equal(requests, 2)
  assert.equal(authentications, 1)
})
