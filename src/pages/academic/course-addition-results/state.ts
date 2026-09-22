import type { AcademicEducationLevel } from '../../../api/academic-credential'
import type {
  AcademicRecordsCache,
  CourseAdditionResultRecord,
} from '../types'

/**
 * 页面身份代际：同时区分平台账号和教务绑定身份。平台账号切换会改变
 * userId，同账号重新绑定教务身份会改变 studentNo / educationLevel；两者都
 * 必须让旧身份的在途响应和缓存失效。
 */
export type CourseAdditionIdentity = {
  userId: number
  studentNo: string
  educationLevel: AcademicEducationLevel
}

export const academicIdentityKey = (identity: CourseAdditionIdentity): string => (
  `${identity.userId}:${identity.studentNo}:${identity.educationLevel}`
)

/**
 * 在途响应守卫：只有请求代际和身份代际都与当前状态一致时才允许把结果
 * 写回页面。请求代际（requestId）覆盖乱序返回与学期切换（切换学期会递增
 * requestId）；身份代际（identityKey）覆盖平台账号切换与同账号教务身份更新。
 */
export const shouldApplyAdditionResponse = (args: {
  requestId: number
  currentRequestId: number
  requestIdentityKey: string
  currentIdentityKey: string
}): boolean => (
  args.requestId === args.currentRequestId
  && args.requestIdentityKey === args.currentIdentityKey
)

/** academicPost 会先清除本地教务凭证再抛出的错误码。 */
export const ACADEMIC_CREDENTIAL_INVALIDATION_CODES = [
  'invalid_academic_credentials',
  'academic_password_expired',
  'academic_account_restricted',
] as const

export type AcademicCredentialInvalidationCode =
  typeof ACADEMIC_CREDENTIAL_INVALIDATION_CODES[number]

export const isAcademicCredentialInvalidationCode = (
  code: unknown,
): code is AcademicCredentialInvalidationCode => (
  typeof code === 'string'
  && (ACADEMIC_CREDENTIAL_INVALIDATION_CODES as readonly string[]).includes(code)
)

export type AdditionErrorAction =
  | 'credential_invalidated'
  | 'identity_switched'
  | 'present_error'

/**
 * 分类请求失败后的处理动作。凭证失效是请求自身导致的（academicPost 已
 * clearAcademicCredential），即使身份守卫判定不一致也必须呈现认证失败引导，
 * 不能被静默吞掉；只有真正的身份切换/乱序才静默丢弃。
 */
export const classifyAdditionError = (
  errorCode: unknown,
  guardPassed: boolean,
): AdditionErrorAction => {
  if (isAcademicCredentialInvalidationCode(errorCode)) return 'credential_invalidated'
  if (!guardPassed) return 'identity_switched'
  return 'present_error'
}

/**
 * 从 records cache 中取出指定身份作用域与学期的加课结果。作用域不一致
 * （含旧缓存没有身份作用域）时返回 null，避免同 platformUserId 换学号/换身份
 * 类型后读到旧数据。
 */
export const additionRecordsForScope = (
  cache: AcademicRecordsCache | null,
  identityScope: string,
  periodId: string,
): { records: CourseAdditionResultRecord[]; updatedAt: number } | null => {
  if (!cache || !identityScope || cache.additionIdentityScope !== identityScope) return null
  return {
    records: cache.additionsByPeriod[periodId] || [],
    updatedAt: cache.additionsUpdatedAtByPeriod[periodId] || 0,
  }
}
