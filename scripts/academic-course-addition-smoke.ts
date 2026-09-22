import { strict as assert } from 'node:assert'
import { resolveRetainedPeriodId } from '../src/pages/academic/utils'
import {
  academicIdentityKey,
  classifyAdditionError,
  isAcademicCredentialInvalidationCode,
  shouldApplyAdditionResponse,
  shouldClearCredentialOnInvalidation,
  shouldWriteAdditionResult,
  type CourseAdditionIdentity,
} from '../src/pages/academic/course-addition-results/state'
import { createAdditionCache } from '../src/pages/academic/course-addition-results/addition-cache'
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

// 学期选择保留：用户已选学期仍在列表中时不能被慢速学期响应覆写。
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

// 身份代际：不同身份必须产生不同的 key，且 key 不暴露明文学号。
assert.notEqual(s1, academicIdentityKey(identity(2, 'S1', 'undergraduate')), '平台账号切换必须改变身份代际')
assert.notEqual(s1, s2, '同账号重新绑定学号必须改变身份代际')
assert.notEqual(s1, academicIdentityKey(identity(1, 'S1', 'graduate')), '同账号切换学生类型必须改变身份代际')
assert.equal(s1, academicIdentityKey(identity(1, 'S1', 'undergraduate')), '相同身份应产生相同代际')
assert.equal(s1.includes('S1'), false, '身份代际不得包含明文学号')

const guard = (overrides: Partial<Parameters<typeof shouldApplyAdditionResponse>[0]> = {}) => (
  shouldApplyAdditionResponse({
    requestId: 3,
    currentRequestId: 3,
    requestIdentityKey: s1,
    currentIdentityKey: s1,
    ...overrides,
  })
)

// 在途响应守卫：一致时应用，乱序、身份变化时丢弃。
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

// 加课缓存真实读写序列：换身份作用域后不读旧身份缓存，写入不污染旧 map。
const store = new Map<string, unknown>()
const cache = createAdditionCache({
  get: (key) => store.get(key),
  set: (key, value) => { store.set(key, value) },
})

cache.setAdditionRecords(1, s1, 'P1', [additionRecord('a1')])
cache.setAdditionRecords(1, s1, 'P2', [additionRecord('a2')])
assert.equal(cache.getAdditionRecords(1, s1, 'P1')?.records[0].id, 'a1', 'S1 应读到自己的 P1')
assert.equal(cache.getAdditionRecords(1, s1, 'P2')?.records[0].id, 'a2', 'S1 应读到自己的 P2')
assert.equal(cache.getAdditionRecords(1, s2, 'P2'), null, '换 S2 后不得读 S1 的 P2')

// S2 写 P1（作用域变化应清空旧 map，只保留本次记录）
cache.setAdditionRecords(1, s2, 'P1', [additionRecord('b1')])
assert.equal(cache.getAdditionRecords(1, s2, 'P1')?.records[0].id, 'b1', 'S2 应读到自己的 P1')
assert.equal(
  cache.getAdditionRecords(1, s2, 'P2')?.records.length ?? -1,
  0,
  'S2 写 P1 后不得把 S1 的 P2 当成自己的缓存',
)
assert.equal(cache.getAdditionRecords(1, s1, 'P2'), null, '换身份后 S1 的旧缓存应已失效')

// 凭证失效错误码识别。
for (const code of ['invalid_academic_credentials', 'academic_password_expired', 'academic_account_restricted']) {
  assert.equal(isAcademicCredentialInvalidationCode(code), true, `${code} 应识别为凭证失效`)
}
assert.equal(isAcademicCredentialInvalidationCode('academic_provider_busy'), false, '非失效错误码不应识别为凭证失效')
assert.equal(isAcademicCredentialInvalidationCode(null), false, 'null 不是凭证失效')

// 错误分类：只有当前请求（mounted + 当前 requestId）的凭证失效才呈现；旧请求/已卸载一律忽略。
assert.equal(
  classifyAdditionError({ errorCode: 'invalid_academic_credentials', isMounted: true, isCurrentRequest: true }),
  'credential_invalidated',
  '当前请求凭证失效应呈现重新绑定引导',
)
assert.equal(
  classifyAdditionError({ errorCode: 'invalid_academic_credentials', isMounted: true, isCurrentRequest: false }),
  'stale_ignored',
  '旧请求返回凭证失效不得影响新请求',
)
assert.equal(
  classifyAdditionError({ errorCode: 'invalid_academic_credentials', isMounted: false, isCurrentRequest: true }),
  'stale_ignored',
  '组件卸载后的凭证失效应忽略',
)
assert.equal(
  classifyAdditionError({ errorCode: 'academic_provider_busy', isMounted: true, isCurrentRequest: true }),
  'present_error',
  '当前请求其他错误应呈现',
)
assert.equal(
  classifyAdditionError({ errorCode: 'academic_provider_busy', isMounted: true, isCurrentRequest: false }),
  'stale_ignored',
  '旧请求其他错误应忽略',
)

// 凭证清除条件：只在活跃凭证仍属于发起请求的同一代时才清除。
const clear = shouldClearCredentialOnInvalidation
assert.equal(clear({ snapshotUserId: 1, snapshotStudentNo: 'S1', activeUserId: 1, activeStudentNo: 'S1' }), true, '凭证仍属于请求应清除')
assert.equal(clear({ snapshotUserId: 1, snapshotStudentNo: 'S1', activeUserId: 2, activeStudentNo: 'S1' }), false, '平台账号切换后旧请求不得清除')
assert.equal(clear({ snapshotUserId: 1, snapshotStudentNo: 'S1', activeUserId: 1, activeStudentNo: 'S2' }), false, '同账号换学号后旧请求不得清除')
assert.equal(clear({ snapshotUserId: 1, snapshotStudentNo: 'S1', activeUserId: 1, activeStudentNo: null }), false, '凭证已不存在不得清除')

// 回归场景组合：完整请求生命周期决策。
// 场景1：S1 旧请求失败晚于 S2 成功 —— 不呈现、不清除新身份凭证。
assert.equal(classifyAdditionError({ errorCode: 'invalid_academic_credentials', isMounted: true, isCurrentRequest: false }), 'stale_ignored')
assert.equal(clear({ snapshotUserId: 1, snapshotStudentNo: 'S1', activeUserId: 1, activeStudentNo: 'S2' }), false)
// 场景2：同身份旧请求晚于新请求 —— 乱序丢弃。
assert.equal(shouldApplyAdditionResponse({ requestId: 1, currentRequestId: 2, requestIdentityKey: s1, currentIdentityKey: s1 }), false)
// 场景3：正常当前认证失效 —— 呈现 + 清除。
assert.equal(classifyAdditionError({ errorCode: 'invalid_academic_credentials', isMounted: true, isCurrentRequest: true }), 'credential_invalidated')
assert.equal(clear({ snapshotUserId: 1, snapshotStudentNo: 'S1', activeUserId: 1, activeStudentNo: 'S1' }), true)
// 场景4：卸载后成功返回 —— mounted 短路，不写 storage。
assert.equal(shouldWriteAdditionResult(false, true), false, '卸载后即使守卫通过也不写 storage')
assert.equal(shouldWriteAdditionResult(true, true), true, '挂载且守卫通过才写 storage')

console.log('academic course-addition smoke: ok')
