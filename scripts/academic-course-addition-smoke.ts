import { strict as assert } from 'node:assert'
import { resolveRetainedPeriodId } from '../src/pages/academic/utils'
import {
  academicIdentityKey,
  additionRecordsForScope,
  classifyAdditionError,
  isAcademicCredentialInvalidationCode,
  shouldApplyAdditionResponse,
  type CourseAdditionIdentity,
} from '../src/pages/academic/course-addition-results/state'
import type {
  AcademicPeriod,
  AcademicRecordsCache,
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
assert.equal(
  resolveRetainedPeriodId(periods, previous.id),
  previous.id,
  '用户选择的学期仍在列表中时应保留，而不是回退到默认学期',
)
assert.equal(
  resolveRetainedPeriodId(periods, '2024-2025-1'),
  current.id,
  '选择已失效时应回退到默认当前学期',
)
assert.equal(
  resolveRetainedPeriodId(periods, ''),
  current.id,
  '空选择应回退到默认当前学期',
)
assert.equal(
  resolveRetainedPeriodId([], '2026-2027-1'),
  '',
  '学期列表为空时没有可回退的默认值',
)

const identity = (
  userId: number,
  studentNo: string,
  educationLevel: 'undergraduate' | 'graduate',
): CourseAdditionIdentity => ({ userId, studentNo, educationLevel })

// 身份代际：平台账号切换与同账号教务身份更新都必须产生不同的 key。
assert.notEqual(
  academicIdentityKey(identity(1, 'S1', 'undergraduate')),
  academicIdentityKey(identity(2, 'S1', 'undergraduate')),
  '平台账号切换必须改变身份代际',
)
assert.notEqual(
  academicIdentityKey(identity(1, 'S1', 'undergraduate')),
  academicIdentityKey(identity(1, 'S2', 'undergraduate')),
  '同账号重新绑定学号必须改变身份代际',
)
assert.notEqual(
  academicIdentityKey(identity(1, 'S1', 'undergraduate')),
  academicIdentityKey(identity(1, 'S1', 'graduate')),
  '同账号切换学生类型必须改变身份代际',
)
assert.equal(
  academicIdentityKey(identity(1, 'S1', 'undergraduate')),
  academicIdentityKey(identity(1, 'S1', 'undergraduate')),
  '相同身份应产生相同代际',
)

const guard = (overrides: Partial<Parameters<typeof shouldApplyAdditionResponse>[0]> = {}) => (
  shouldApplyAdditionResponse({
    requestId: 3,
    currentRequestId: 3,
    requestIdentityKey: '1:S1:undergraduate',
    currentIdentityKey: '1:S1:undergraduate',
    ...overrides,
  })
)

// 在途响应守卫：一致时应用，乱序、身份变化时丢弃。
assert.equal(guard(), true, '请求代际与身份代际一致时应应用响应')
assert.equal(
  guard({ requestId: 2 }),
  false,
  '学期切换或请求乱序（旧 requestId）应丢弃响应',
)
assert.equal(
  guard({ currentRequestId: 4 }),
  false,
  '已有更新请求时应丢弃旧响应',
)
assert.equal(
  guard({ currentIdentityKey: '2:S1:undergraduate' }),
  false,
  '平台账号切换后应丢弃旧身份响应',
)
assert.equal(
  guard({ currentIdentityKey: '1:S2:undergraduate' }),
  false,
  '同账号重新绑定学号后应丢弃旧身份响应',
)
assert.equal(
  guard({ requestIdentityKey: '1:S1:graduate', currentIdentityKey: '1:S1:graduate' }),
  true,
  '请求与当前身份一致（同为研究生）时身份校验通过',
)

const additionRecord = (id: string): CourseAdditionResultRecord => ({
  id,
  periodId: 'P',
  periodName: '测试学期',
  courseCode: 'CS101',
  courseName: `课程${id}`,
  selectionCode: '26202086',
  teacher: '张老师',
  teachingClass: '计算机班',
  auditText: '审核中',
})

const recordsCache = (
  identityScope: string | undefined,
): AcademicRecordsCache => ({
  version: 1,
  platformUserId: 1,
  grades: [],
  gradesUpdatedAt: 0,
  examsByPeriod: {},
  examsUpdatedAtByPeriod: {},
  selectionsByPeriod: {},
  selectionsUpdatedAtByPeriod: {},
  additionsByPeriod: { P: [additionRecord('a1')] },
  additionsUpdatedAtByPeriod: { P: 123 },
  ...(identityScope !== undefined ? { additionIdentityScope: identityScope } : {}),
})

// 加课缓存身份作用域：同 platformUserId 换学号/换类型后不读旧缓存。
assert.ok(
  additionRecordsForScope(recordsCache('1:S1:undergraduate'), '1:S1:undergraduate', 'P'),
  '作用域一致时应命中缓存',
)
assert.equal(
  additionRecordsForScope(recordsCache('1:S1:undergraduate'), '1:S2:undergraduate', 'P'),
  null,
  '同 platformUserId 换学号后不得读旧缓存',
)
assert.equal(
  additionRecordsForScope(recordsCache('1:S1:undergraduate'), '1:S1:graduate', 'P'),
  null,
  '同 platformUserId 换学生类型后不得读旧缓存',
)
assert.equal(
  additionRecordsForScope(recordsCache(undefined), '1:S1:undergraduate', 'P'),
  null,
  '旧缓存没有身份作用域时不得采用',
)
assert.equal(
  additionRecordsForScope(null, '1:S1:undergraduate', 'P'),
  null,
  '无缓存应返回 null',
)

// 凭证失效错误码识别。
for (const code of ['invalid_academic_credentials', 'academic_password_expired', 'academic_account_restricted']) {
  assert.equal(isAcademicCredentialInvalidationCode(code), true, `${code} 应识别为凭证失效`)
}
assert.equal(isAcademicCredentialInvalidationCode('academic_provider_busy'), false, '非失效错误码不应识别为凭证失效')
assert.equal(isAcademicCredentialInvalidationCode(null), false, 'null 不是凭证失效')
assert.equal(isAcademicCredentialInvalidationCode(undefined), false, 'undefined 不是凭证失效')

// 凭证失效错误路径：即使守卫判定不一致也必须呈现认证引导，不能被静默吞掉。
assert.equal(
  classifyAdditionError('invalid_academic_credentials', false),
  'credential_invalidated',
  '凭证失效错误不能因守卫 false 被静默吞掉',
)
assert.equal(
  classifyAdditionError('academic_password_expired', true),
  'credential_invalidated',
  '密码过期即使守卫通过也要呈现重新绑定引导',
)
assert.equal(
  classifyAdditionError('academic_account_restricted', false),
  'credential_invalidated',
  '账号受限不能因守卫 false 被静默吞掉',
)
assert.equal(
  classifyAdditionError('academic_provider_busy', false),
  'identity_switched',
  '非失效错误 + 守卫 false 才是身份切换静默丢弃',
)
assert.equal(
  classifyAdditionError('academic_provider_busy', true),
  'present_error',
  '非失效错误 + 守卫通过应正常呈现错误',
)
assert.equal(
  classifyAdditionError(null, false),
  'identity_switched',
  '无错误码 + 守卫 false 静默丢弃',
)

console.log('academic course-addition smoke: ok')
