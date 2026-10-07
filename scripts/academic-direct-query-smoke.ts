import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

type AcademicRequest = { path: string; data: Record<string, unknown> }

const state: {
  currentUserId: number
  credentialRevision: number
  credentials: Map<number, { studentNo: string; password: string }>
  requests: AcademicRequest[]
  hostingStatusCalls: number
  hostingIntentCalls: number
  hostingTaskCalls: number
  verificationStatusCalls: number
  clearedUserIds: number[]
  requestHandler?: (request: AcademicRequest) => Promise<{ data: unknown[] }>
} = {
  currentUserId: 7,
  credentialRevision: 1,
  credentials: new Map([
    [7, { studentNo: '20260007', password: '原样 Password！abc' }],
    [8, { studentNo: '20260008', password: 'other-user-secret' }],
  ]),
  requests: [],
  hostingStatusCalls: 0,
  hostingIntentCalls: 0,
  hostingTaskCalls: 0,
  verificationStatusCalls: 0,
  clearedUserIds: [],
}

class MockApiError extends Error {
  statusCode = 401
  code = 'invalid_academic_credentials'
}

const replaceModule = (path: string, exports: Record<string, unknown>) => {
  const resolved = require.resolve(path)
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports,
    children: [],
    paths: [],
  } as NodeModule
}

replaceModule('../src/api/client', {
  apiRequest: async () => [],
  apiRequestEnvelope: async (request: AcademicRequest) => {
    state.requests.push(request)
    return state.requestHandler
      ? state.requestHandler(request)
      : { data: [{ path: request.path }] }
  },
  isApiError: (error: unknown) => error instanceof MockApiError,
})
replaceModule('../src/api/account', {
  getCurrentIdentity: async () => ({ user_id: state.currentUserId }),
})
replaceModule('../src/api/academic-credential', {
  clearAcademicCredential: (userId: number) => {
    state.clearedUserIds.push(userId)
    state.credentials.delete(userId)
  },
  getCredentialRevision: () => state.credentialRevision,
  loadAcademicCredential: (userId: number) => {
    const credential = state.credentials.get(userId)
    if (!credential) {
      const error = new Error('missing local credential')
      error.name = 'AcademicCredentialMissingError'
      throw error
    }
    return { ...credential, educationLevel: 'undergraduate' }
  },
})
replaceModule('../src/state/shared-resource', {
  createSharedResource: () => ({
    ensure: (load: () => unknown) => load(),
    invalidate: () => {},
  }),
})
replaceModule('../src/state/page-cache', {
  getCachedPageUserId: () => state.currentUserId,
  getPageSessionGeneration: () => 1,
})

const academic = require('../src/api/academic') as typeof import('../src/api/academic')
const academicApiSource = readFileSync(resolve(__dirname, '../src/api/academic.ts'), 'utf8')

const run = async () => {
  const queries: Array<{
    run: () => Promise<unknown>
    path: string
    periodId?: string
  }> = [
    { run: () => academic.listAcademicCourses('2026-fall'), path: '/api/v1/academic/courses', periodId: '2026-fall' },
    { run: () => academic.listAcademicExams('2026-fall'), path: '/api/v1/academic/exams', periodId: '2026-fall' },
    { run: () => academic.listAcademicGrades(), path: '/api/v1/academic/grades' },
    { run: () => academic.listAcademicCourseSelections('2026-fall'), path: '/api/v1/academic/course-selections', periodId: '2026-fall' },
    { run: () => academic.listAcademicCourseSelectionSchedule('2026-fall'), path: '/api/v1/academic/course-selection-schedule', periodId: '2026-fall' },
    { run: () => academic.listAcademicCourseAdditionResults('2026-fall'), path: '/api/v1/academic/course-addition-results', periodId: '2026-fall' },
  ]

  for (const query of queries) {
    await query.run()
  }

  assert.deepEqual(state.requests.map(({ path }) => path), queries.map(({ path }) => path))
  for (let index = 0; index < queries.length; index += 1) {
    assert.deepEqual(state.requests[index].data, {
      student_no: '20260007',
      password: '原样 Password！abc',
      ...(queries[index].periodId ? { period_id: queries[index].periodId } : {}),
    }, `${queries[index].path} 必须提交本机账号密码原值`)
  }
  assert.equal(state.hostingStatusCalls, 0, '业务查询不得读取服务端托管状态')
  assert.equal(state.hostingIntentCalls, 0, '业务查询不得创建托管意图')
  assert.equal(state.hostingTaskCalls, 0, '业务查询不得创建或轮询托管任务')
  assert.equal(state.verificationStatusCalls, 0, '普通查询不应依赖身份托管状态')
  assert.doesNotMatch(
    academicApiSource,
    /academic-credential-hosting|getAcademicVerificationStatus|runAcademicCredentialHostingTask/,
    '普通查询实现不得依赖凭据托管接口或托管身份状态',
  )

  let markRequestStarted!: () => void
  let rejectPendingRequest!: (error: Error) => void
  const requestStarted = new Promise<void>((resolve) => { markRequestStarted = resolve })
  state.requestHandler = () => new Promise((_, reject) => {
    rejectPendingRequest = reject
    markRequestStarted()
  })
  state.currentUserId = 7
  const pendingQuery = academic.listAcademicGrades()
  await requestStarted
  state.currentUserId = 8
  rejectPendingRequest(new MockApiError('school rejected credentials'))
  await assert.rejects(pendingQuery, MockApiError)
  assert.deepEqual(state.clearedUserIds, [7], '旧账号请求失败只能清理发起请求的本地账号')
  assert.equal(state.credentials.has(8), true, '账号切换不能清除新账号的凭据')

  process.stdout.write('academic direct query smoke: ok\n')
}

void run()
