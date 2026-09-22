import { strict as assert } from 'node:assert'
import { resolveRetainedPeriodId } from '../src/pages/academic/utils'
import {
  academicCacheScope,
  academicIdentityKey,
  classifyAdditionError,
  shouldApplyAdditionResponse,
  shouldWriteAdditionResult,
  type CourseAdditionIdentity,
} from '../src/pages/academic/course-addition-results/state'
import { createAdditionCache } from '../src/pages/academic/course-addition-results/addition-cache'
import { createAcademicPost } from '../src/api/academic-post'
import {
  clearAcademicCredential,
  getCredentialRevision,
  hasAcademicCredential,
  loadAcademicCredential,
  saveAcademicCredential,
} from '../src/api/academic-credential'
import type {
  AcademicPeriod,
  CourseAdditionResultRecord,
} from '../src/pages/academic/types'

const period = (
  id: string,
  startDate: string,
  isCurrent = false,
): AcademicPeriod => ({
  id,
  label: id,
  shortLabel: id,
  startDate,
  weeks: 19,
  isCurrent,
})

const current = period('2026-2027-1', '2026/08/24', true)
const previous = period('2025-2026-3', '2026/03/09')
const periods = [previous, current]

assert.equal(resolveRetainedPeriodId(periods, previous.id), previous.id, '用户选择的学期仍在列表中时应保留')
assert.equal(resolveRetainedPeriodId(periods, '2024-2025-1'), current.id, '选择已失效时应回退到默认当前学期')
assert.equal(resolveRetainedPeriodId(periods, ''), current.id, '空选择应回退到默认当前学期')
assert.equal(resolveRetainedPeriodId([], '2026-2027-1'), '', '学期列表为空时没有可回退的默认值')

const identity = (
  userId: number,
  studentNo: string,
  educationLevel: 'undergraduate' | 'graduate',
): CourseAdditionIdentity => ({ userId, studentNo, educationLevel })

const s1 = academicIdentityKey(identity(1, 'S1', 'undergraduate'))
const s2 = academicIdentityKey(identity(1, 'S2', 'undergraduate'))
const scope1 = academicCacheScope(identity(1, 'S1', 'undergraduate'))
const scope2 = academicCacheScope(identity(1, 'S2', 'undergraduate'))

assert.notEqual(s1, academicIdentityKey(identity(2, 'S1', 'undergraduate')), '平台账号切换必须改变身份代际')
assert.notEqual(s1, s2, '同账号重新绑定学号必须改变身份代际')
assert.notEqual(s1, academicIdentityKey(identity(1, 'S1', 'graduate')), '同账号切换学生类型必须改变身份代际')
assert.equal(s1, academicIdentityKey(identity(1, 'S1', 'undergraduate')), '相同身份应产生相同代际')

// 缓存作用域：不同身份必须产生不同摘要，且摘要不包含明文学号。
assert.notEqual(scope1, scope2, '不同身份的缓存作用域必须不同')
assert.notEqual(scope1, academicCacheScope(identity(1, 'S1', 'graduate')), '同账号换学生类型缓存作用域必须不同')
assert.equal(scope1, academicCacheScope(identity(1, 'S1', 'undergraduate')), '相同身份缓存作用域必须一致')
assert.equal(scope1.includes('S1'), false, '缓存作用域不得包含明文学号')

const guard = (overrides: Partial<Parameters<typeof shouldApplyAdditionResponse>[0]> = {}) => (
  shouldApplyAdditionResponse({
    requestId: 3,
    currentRequestId: 3,
    requestIdentityKey: s1,
    currentIdentityKey: s1,
    ...overrides,
  })
)

assert.equal(guard(), true, '请求代际与身份代际一致时应应用响应')
assert.equal(guard({ requestId: 2 }), false, '学期切换或请求乱序应丢弃响应')
assert.equal(guard({ currentRequestId: 4 }), false, '已有更新请求时应丢弃旧响应')
assert.equal(guard({ currentIdentityKey: s2 }), false, '同账号换学号后应丢弃旧身份响应')

const additionRecord = (id: string): CourseAdditionResultRecord => ({
  id,
  periodId: 'P1',
  periodName: '测试学期',
  courseCode: 'CS101',
  courseName: `课程${id}`,
  selectionCode: '26202086',
  teacher: '张老师',
  teachingClass: '计算机班',
  auditText: '审核中',
})

const store = new Map<string, unknown>()
const cache = createAdditionCache({
  get: (key) => store.get(key),
  set: (key, value) => { store.set(key, value) },
})

cache.setAdditionRecords(1, scope1, 'P1', [additionRecord('a1')])
cache.setAdditionRecords(1, scope1, 'P2', [additionRecord('a2')])
assert.equal(cache.getAdditionRecords(1, scope1, 'P1')?.records[0].id, 'a1', 'S1 应读到自己的 P1')
assert.equal(cache.getAdditionRecords(1, scope1, 'P2')?.records[0].id, 'a2', 'S1 应读到自己的 P2')
assert.equal(cache.getAdditionRecords(1, scope2, 'P2'), null, '换 S2 后不得读 S1 的 P2')

cache.setAdditionRecords(1, scope2, 'P1', [additionRecord('b1')])
assert.equal(cache.getAdditionRecords(1, scope2, 'P1')?.records[0].id, 'b1', 'S2 应读到自己的 P1')
assert.equal(cache.getAdditionRecords(1, scope2, 'P2')?.records.length ?? -1, 0, 'S2 写 P1 后不得把 S1 的 P2 当成自己的缓存')
assert.equal(cache.getAdditionRecords(1, scope1, 'P2'), null, '换身份后 S1 的旧缓存应已失效')

// 坏缓存边界：null map / 非数组记录应返回 null，不进入页面 .map 白屏。
const badStore = new Map<string, unknown>()
const badCache = createAdditionCache({
  get: (key) => badStore.get(key),
  set: (key, value) => { badStore.set(key, value) },
})
badStore.set('academic.additionRecords.v1.1', {
  version: 1, platformUserId: 1, identityScope: scope1,
  additionsByPeriod: null,
  additionsUpdatedAtByPeriod: {},
})
assert.equal(badCache.getAdditionRecords(1, scope1, 'P1'), null, 'null map 应返回 null')
badStore.set('academic.additionRecords.v1.1', {
  version: 1, platformUserId: 1, identityScope: scope1,
  additionsByPeriod: { P1: 'not-an-array' },
  additionsUpdatedAtByPeriod: { P1: 123 },
})
assert.equal(badCache.getAdditionRecords(1, scope1, 'P1'), null, '非数组记录应返回 null')

// 错误分类：只有当前请求（mounted + 当前 requestId）且 academicPost 实际清除了凭证才呈现。
assert.equal(
  classifyAdditionError({ isMounted: true, isCurrentRequest: true, credentialInvalidatedHere: true }),
  'credential_invalidated',
  '当前请求凭证失效应呈现重新绑定引导',
)
assert.equal(
  classifyAdditionError({ isMounted: true, isCurrentRequest: false, credentialInvalidatedHere: true }),
  'stale_ignored',
  '旧请求即使标记了凭证失效也应忽略',
)
assert.equal(
  classifyAdditionError({ isMounted: false, isCurrentRequest: true, credentialInvalidatedHere: true }),
  'stale_ignored',
  '组件卸载后的凭证失效应忽略',
)
assert.equal(
  classifyAdditionError({ isMounted: true, isCurrentRequest: true, credentialInvalidatedHere: false }),
  'present_error',
  '当前请求其他错误应呈现',
)
assert.equal(shouldWriteAdditionResult(false, true), false, '卸载后即使守卫通过也不写 storage')
assert.equal(shouldWriteAdditionResult(true, true), true, '挂载且守卫通过才写 storage')

// 真实凭证代际时序：旧密码请求 A 在途 → 重新认证新密码 → 新请求 B 成功 → A 返回失效。
const runLifecycle = async () => {
  clearAcademicCredential()
  saveAcademicCredential(1, { studentNo: 'S1', password: 'oldPassword', educationLevel: 'undergraduate' })
  const revisionAfterSave = getCredentialRevision()

  const pending: Array<{ resolve: (value: unknown) => void; reject: (error: unknown) => void }> = []
  const post = createAcademicPost({
    getCurrentIdentity: async () => ({ user_id: 1 }),
    loadCredential: (userId) => loadAcademicCredential(userId),
    getCredentialRevision,
    clearCredential: () => clearAcademicCredential(),
    requestEnvelope: () => new Promise((resolve, reject) => {
      pending.push({ resolve, reject })
    }),
    isCredentialInvalidationError: (error) => (
      Boolean(error) && (error as { code?: string }).code === 'invalid_academic_credentials'
    ),
  })

  const promiseA = post('/api/v1/academic/course-addition-results', 'P')
  await new Promise((resolve) => setTimeout(resolve, 0))

  // 重新认证，保存新密码（同一 user 同学号，仅密码变化）。
  saveAcademicCredential(1, { studentNo: 'S1', password: 'newPassword', educationLevel: 'undergraduate' })
  assert.ok(getCredentialRevision() > revisionAfterSave, '保存新凭证应递增 revision')

  const promiseB = post('/api/v1/academic/course-addition-results', 'P')
  await new Promise((resolve) => setTimeout(resolve, 0))
  pending[1].resolve({ data: [additionRecord('b1')] })
  await promiseB

  pending[0].reject({ code: 'invalid_academic_credentials' })
  let errorA: unknown = null
  try {
    await promiseA
  } catch (error) {
    errorA = error
  }
  assert.equal((errorA as { code?: string })?.code, 'invalid_academic_credentials', '旧请求应返回认证失效')
  assert.equal((errorA as { credentialInvalidated?: boolean })?.credentialInvalidated, undefined, '旧请求不得标记清除了凭证')
  assert.equal(loadAcademicCredential(1).password, 'newPassword', '旧请求返回失效不得清除刚保存的新凭证')
}

const runCurrentInvalidation = async () => {
  clearAcademicCredential()
  saveAcademicCredential(1, { studentNo: 'S1', password: 'password', educationLevel: 'undergraduate' })

  const pending: Array<{ resolve: (value: unknown) => void; reject: (error: unknown) => void }> = []
  const post = createAcademicPost({
    getCurrentIdentity: async () => ({ user_id: 1 }),
    loadCredential: (userId) => loadAcademicCredential(userId),
    getCredentialRevision,
    clearCredential: () => clearAcademicCredential(),
    requestEnvelope: () => new Promise((resolve, reject) => {
      pending.push({ resolve, reject })
    }),
    isCredentialInvalidationError: (error) => (
      Boolean(error) && (error as { code?: string }).code === 'invalid_academic_credentials'
    ),
  })

  const promise = post('/api/v1/academic/course-addition-results', 'P')
  await new Promise((resolve) => setTimeout(resolve, 0))
  pending[0].reject({ code: 'invalid_academic_credentials' })
  let error: unknown = null
  try {
    await promise
  } catch (caught) {
    error = caught
  }
  assert.equal((error as { credentialInvalidated?: boolean })?.credentialInvalidated, true, '当前凭证失效应标记清除')
  assert.equal(hasAcademicCredential(1), false, '普通当前凭证失效必须确实被清除')
}

// 同一 revision 内请求序号/最新成功保护：A、B 同 revision，B 先成功，A 后返回失效。
const runSameRevisionOrdering = async () => {
  clearAcademicCredential()
  saveAcademicCredential(1, { studentNo: 'S1', password: 'password', educationLevel: 'undergraduate' })

  const pending: Array<{ resolve: (value: unknown) => void; reject: (error: unknown) => void }> = []
  const post = createAcademicPost({
    getCurrentIdentity: async () => ({ user_id: 1 }),
    loadCredential: (userId) => loadAcademicCredential(userId),
    getCredentialRevision,
    clearCredential: () => clearAcademicCredential(),
    requestEnvelope: () => new Promise((resolve, reject) => {
      pending.push({ resolve, reject })
    }),
    isCredentialInvalidationError: (error) => (
      Boolean(error) && (error as { code?: string }).code === 'invalid_academic_credentials'
    ),
  })

  const promiseA = post('/api/v1/academic/course-addition-results', 'P')
  await new Promise((resolve) => setTimeout(resolve, 0))
  const promiseB = post('/api/v1/academic/course-addition-results', 'P')
  await new Promise((resolve) => setTimeout(resolve, 0))

  // B 先成功，更新最新成功序号。
  pending[1].resolve({ data: [additionRecord('b1')] })
  await promiseB

  // A 后返回失效：revision 未变，但已有更新的成功请求，不得清除凭证。
  pending[0].reject({ code: 'invalid_academic_credentials' })
  let errorA: unknown = null
  try {
    await promiseA
  } catch (error) {
    errorA = error
  }
  assert.equal((errorA as { credentialInvalidated?: boolean })?.credentialInvalidated, undefined, 'B 成功后 A 不得标记清除凭证')
  assert.equal(loadAcademicCredential(1).password, 'password', 'B 成功后 A 返回失效不得清除凭证')
}

const run = async () => {
  await runLifecycle()
  await runCurrentInvalidation()
  await runSameRevisionOrdering()
  console.log('academic course-addition smoke: ok')
}

void run()
