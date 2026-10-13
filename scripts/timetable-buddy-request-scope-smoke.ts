import { strict as assert } from 'node:assert'
import Module = require('node:module')

type RequestOptions = {
  path: string
  method?: string
  data?: unknown
  isScopeCurrent?: () => boolean
}
type RequestRecord = { options: RequestOptions; scope: string }

const loader = Module as unknown as { _load: (...args: any[]) => any }
const originalLoad = loader._load
let currentScope = 'account-a'
const repositoryRequests: RequestRecord[] = []
const privateMessageRequests: RequestRecord[] = []
const side = {
  user_id: 1,
  nickname: 'A',
  share_scope: 'both',
  paused: false,
  synced_at: null,
  data_status: 'ready',
  custom_courses_ready: true,
  custom_courses_synced_at: null,
  courses: [],
  busy_slots: [],
}
const connection = { id: 7, relation_type: 'friend', members: [], created_at: 'now' }
const repositoryResponse = (options: RequestOptions & { method?: string }) => {
  const { path } = options
  if (options.method === 'DELETE' && path.endsWith('/invitations')) return { connection: null }
  if (path.endsWith('/invitations')) return { token: 'invite', expires_at: 'later' }
  if (path.endsWith('/preview')) return {
    creator_nickname: 'A', creator_avatar_url: '', relation_type: 'friend', expires_at: 'later',
  }
  if (path.endsWith('/schedule')) return {
    connection, me: side, buddy: side, common_free_slots: [],
  }
  if (path.endsWith('/custom-courses')) return side
  return { connection: null }
}

loader._load = function (name, parent, ...args) {
  if (parent?.filename?.endsWith('/src/api/timetable-buddy.ts') && name === './client') {
    return {
      apiRequest: async (options: RequestOptions) => {
        repositoryRequests.push({ options, scope: currentScope })
        assert.equal(options.isScopeCurrent?.(), true, `${options.path} captures its starting account scope`)
        return repositoryResponse(options)
      },
      createIdempotencyKey: () => 'idempotency-key',
    }
  }
  if (parent?.filename?.endsWith('/src/api/timetable-buddy.ts') && name === '../state/page-cache') {
    return { getPageCacheScope: () => currentScope }
  }
  if (parent?.filename?.endsWith('/src/features/direct-messages/repository.ts') && name === '../../api/client') {
    return {
      apiRequest: async (options: RequestOptions) => {
        privateMessageRequests.push({ options, scope: currentScope })
        return { id: 23 }
      },
    }
  }
  if (parent?.filename?.endsWith('/src/features/direct-messages/repository.ts') && name === '../../state/page-cache') {
    return { getPageCacheScope: () => currentScope }
  }
  return originalLoad.call(this, name, parent, ...args)
}

const repository = require('../src/api/timetable-buddy').timetableBuddyRepository as {
  getState: () => Promise<unknown>
  createInvitation: (input: unknown) => Promise<unknown>
  revokeInvitation: (token: string) => Promise<unknown>
  previewInvitation: (token: string) => Promise<unknown>
  acceptInvitation: (token: string) => Promise<unknown>
  syncCustomCourses: (input: unknown) => Promise<unknown>
  getSchedule: (input: unknown) => Promise<unknown>
  updateSettings: (input: unknown) => Promise<unknown>
  disconnect: (connectionId: number) => Promise<unknown>
}
const privateMessagesRepository = require('../src/features/direct-messages/repository').privateMessagesRepository as {
  createConversation: (peerId: number, isScopeCurrent?: () => boolean) => Promise<unknown>
}
loader._load = originalLoad

let scopeNumber = 0
const invokeRepositoryEndpoint = async (action: () => Promise<unknown>) => {
  currentScope = `account-${++scopeNumber}`
  const previousCount = repositoryRequests.length
  await action()
  assert.equal(repositoryRequests.length, previousCount + 1)
}

let requestHandler: (options: unknown) => Promise<unknown> = async () => ({
  statusCode: 200,
  data: { data: { ok: true }, request_id: 'request-id' },
})
let ensureHandler: () => Promise<string> = async () => 'account-a-token'
let refreshHandler: () => Promise<string> = async () => 'account-a-refreshed-token'
let requestCount = 0
let reportedErrors = 0
let verificationNavigations = 0

loader._load = function (name, parent, ...args) {
  if (parent?.filename?.endsWith('/src/api/client.ts')) {
    if (name === '@tarojs/taro') {
      return { default: { request: async (options: unknown) => {
        requestCount += 1
        return requestHandler(options)
      } } }
    }
    if (name === './auth') {
      return {
        apiUrl: (path: string) => path,
        ensureAccessToken: () => ensureHandler(),
        refreshAccessToken: () => refreshHandler(),
      }
    }
    if (name === '../features/academic-verification/guard') {
      return { handleAcademicVerificationRequired: async () => { verificationNavigations += 1 } }
    }
    if (name === '../features/error-reporting') {
      return { reportClientError: async () => { reportedErrors += 1 } }
    }
    if (name === '../state/shared-resource') return { invalidateSharedResourceGroup: () => undefined }
    if (name === '../utils/miniapp-version') return { getMiniappVersion: () => '' }
  }
  return originalLoad.call(this, name, parent, ...args)
}
const client = require('../src/api/client') as {
  apiRequest: (options: RequestOptions) => Promise<unknown>
}
loader._load = originalLoad

void (async () => {
  await invokeRepositoryEndpoint(() => repository.getState())
  await invokeRepositoryEndpoint(() => repository.createInvitation({}))
  await invokeRepositoryEndpoint(() => repository.revokeInvitation('a'.repeat(64)))
  await invokeRepositoryEndpoint(() => repository.previewInvitation('token'))
  await invokeRepositoryEndpoint(() => repository.acceptInvitation('token'))
  await invokeRepositoryEndpoint(() => repository.syncCustomCourses({}))
  await invokeRepositoryEndpoint(() => repository.getSchedule({}))
  await invokeRepositoryEndpoint(() => repository.updateSettings({}))
  await invokeRepositoryEndpoint(() => repository.disconnect(7))
  assert.equal(repositoryRequests.length, 9, '搭子所有 API 入口都使用 scope guard')
  const revokeRequest = repositoryRequests.find((request) => request.options.method === 'DELETE')
  assert.equal(revokeRequest?.options.path, '/api/v1/me/timetable-buddy/invitations')
  assert.deepEqual(revokeRequest?.options.data, { token: 'a'.repeat(64) }, '撤销请求必须携带邀请 token')
  for (const request of repositoryRequests) {
    currentScope = `${request.scope}-after-account-switch`
    assert.equal(request.options.isScopeCurrent?.(), false, `${request.options.path} is invalid after account switch`)
  }
  currentScope = 'chat-account-a'
  await privateMessagesRepository.createConversation(23, () => currentScope === 'chat-account-a')
  assert.equal(privateMessageRequests.length, 1)
  assert.equal(privateMessageRequests[0].options.isScopeCurrent?.(), true, '创建私信时须捕获发起者账号 scope')
  currentScope = 'chat-account-b'
  assert.equal(privateMessageRequests[0].options.isScopeCurrent?.(), false, '等待创建私信期间切账号必须让旧请求失效')

  let scopeCurrent = true
  let resolveEnsure: ((token: string) => void) | undefined
  ensureHandler = () => new Promise((resolve) => { resolveEnsure = resolve })
  const beforeSend = client.apiRequest({ path: '/custom-courses', method: 'PUT', isScopeCurrent: () => scopeCurrent })
  await Promise.resolve()
  scopeCurrent = false
  resolveEnsure?.('account-b-token')
  await assert.rejects(beforeSend, (error: Error) => error.name === 'RequestScopeChangedError')
  assert.equal(requestCount, 0, 'token 等待期间切账号时不能发送旧请求')

  scopeCurrent = true
  ensureHandler = async () => 'account-a-token'
  requestHandler = async () => {
    scopeCurrent = false
    return {
      statusCode: 403,
      data: { error: { code: 'academic_verification_required', message: 'verification required' } },
    }
  }
  const staleResponse = client.apiRequest({ path: '/custom-courses', isScopeCurrent: () => scopeCurrent })
  await assert.rejects(staleResponse, (error: Error) => error.name === 'RequestScopeChangedError')
  assert.equal(verificationNavigations, 0, '旧账号响应不能触发新会话的认证导航')
  assert.equal(reportedErrors, 0, '旧账号响应不能触发新会话的错误上报')

  scopeCurrent = true
  requestHandler = async () => {
    scopeCurrent = false
    return { statusCode: 503, data: { error: { code: 'unavailable', message: 'unavailable' } } }
  }
  const reportCountBeforeStaleServerError = reportedErrors
  const staleServerError = client.apiRequest({ path: '/custom-courses', isScopeCurrent: () => scopeCurrent })
  await assert.rejects(staleServerError, (error: Error) => error.name === 'RequestScopeChangedError')
  assert.equal(reportedErrors, reportCountBeforeStaleServerError, '旧账号 5xx 响应不能上报到新会话')

  scopeCurrent = true
  requestHandler = async () => ({
    statusCode: 401,
    data: { error: { code: 'session_expired', message: 'expired' } },
  })
  let resolveRefresh: ((token: string) => void) | undefined
  let refreshStarted: (() => void) | undefined
  const refreshIsStarted = new Promise<void>((resolve) => { refreshStarted = resolve })
  refreshHandler = () => new Promise((resolve) => {
    resolveRefresh = resolve
    refreshStarted?.()
  })
  const beforeRetry = client.apiRequest({ path: '/custom-courses', isScopeCurrent: () => scopeCurrent })
  const beforeRetryRequests = requestCount
  await refreshIsStarted
  scopeCurrent = false
  resolveRefresh?.('account-b-token')
  await assert.rejects(beforeRetry, (error: Error) => error.name === 'RequestScopeChangedError')
  assert.equal(requestCount, beforeRetryRequests + 1, '刷新完成时已切账号，不得重试原请求')

  console.log('timetable-buddy request scope smoke: ok')
})().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
