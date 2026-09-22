import type { AcademicEducationLevel } from '../../../api/academic-credential'

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

// 不可逆编码，避免把真实学号以明文持久化到本地 storage。
const hashIdentity = (value: string): string => {
  let hash = 5381
  for (let index = 0; index < value.length; index++) {
    hash = ((hash << 5) + hash + value.charCodeAt(index)) >>> 0
  }
  return hash.toString(36)
}

export const academicIdentityKey = (identity: CourseAdditionIdentity): string => (
  hashIdentity(`${identity.userId}:${identity.studentNo}:${identity.educationLevel}`)
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
  | 'stale_ignored'
  | 'present_error'

/**
 * 分类请求失败后的处理动作。先验证组件仍挂载且请求仍是当前请求（旧请求、
 * 已卸载组件的结果一律忽略）；只有当前请求的凭证失效才清空显示并呈现重新
 * 绑定引导。旧身份/旧请求返回失效不会影响新身份或新请求。
 */
export const classifyAdditionError = (args: {
  errorCode: unknown
  isMounted: boolean
  isCurrentRequest: boolean
}): AdditionErrorAction => {
  if (!args.isMounted || !args.isCurrentRequest) return 'stale_ignored'
  if (isAcademicCredentialInvalidationCode(args.errorCode)) return 'credential_invalidated'
  return 'present_error'
}
