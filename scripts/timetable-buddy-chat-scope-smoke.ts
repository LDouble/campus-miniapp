import { strict as assert } from 'node:assert'
import Module = require('node:module')

type RequestOptions = {
  url: string
  method: string
  data?: unknown
  header: Record<string, string>
}

const loader = Module as unknown as { _load: (...args: any[]) => any }
const originalLoad = loader._load
let accountScope = 'account-a'
let requestCount = 0
let refreshCount = 0
let errorReportCount = 0
const requests: RequestOptions[] = []

loader._load = function (name, parent, ...args) {
  if (parent?.filename?.endsWith('/src/api/client.ts')) {
    if (name === '@tarojs/taro') {
      return { default: { request: async (options: RequestOptions) => {
        requestCount += 1
        requests.push(options)
        accountScope = 'account-b'
        return {
          statusCode: 401,
          data: { error: { code: 'session_expired', message: 'expired' } },
        }
      } } }
    }
    if (name === './auth') {
      return {
        apiUrl: (path: string) => path,
        ensureAccessToken: async () => 'account-a-token',
        refreshAccessToken: async () => {
          refreshCount += 1
          return 'account-b-token'
        },
      }
    }
    if (name === '../features/academic-verification/guard') {
      return { handleAcademicVerificationRequired: async () => undefined }
    }
    if (name === '../features/error-reporting') {
      return { reportClientError: async () => { errorReportCount += 1 } }
    }
    if (name === '../state/shared-resource') return { invalidateSharedResourceGroup: () => undefined }
    if (name === '../utils/miniapp-version') return { getMiniappVersion: () => '' }
  }
  if (parent?.filename?.endsWith('/src/features/direct-messages/repository.ts') && name === '../../state/page-cache') {
    return { getPageCacheScope: () => accountScope }
  }
  return originalLoad.call(this, name, parent, ...args)
}

const repository = require('../src/features/direct-messages/repository').privateMessagesRepository as {
  createConversation: (peerId: number, isScopeCurrent: () => boolean) => Promise<unknown>
}
loader._load = originalLoad

void (async () => {
  const requestScope = accountScope
  await assert.rejects(
    repository.createConversation(902, () => accountScope === requestScope),
    (error: Error) => error.name === 'RequestScopeChangedError',
  )
  assert.equal(requestCount, 1, '旧账号创建会话请求只能发送一次')
  assert.equal(requests[0].method, 'POST')
  assert.deepEqual(requests[0].data, { peer_id: 902 })
  assert.equal(requests[0].header.Authorization, 'Bearer account-a-token', '首次请求只携带 A 的 token')
  assert.equal(refreshCount, 0, 'A 请求返回 401 时已切换到 B，不得使用 B 的 refresh token')
  assert.equal(errorReportCount, 0, '旧会话的 401 不得触发新账号的错误副作用')
  console.log('timetable-buddy chat scope smoke: ok')
})().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
