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
  /** 身份绑定随机 token，作为持久化缓存作用域（旧数据可能为空串）。 */
  identityScopeToken: string
}

/**
 * 内存身份比较：完整 tuple，用于 React key 与在途响应守卫。学号仅存在于
 * 内存（React key / 守卫比较），不写入日志或 UI，也不持久化。
 */
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

/** 成功回包是否写回：组件必须仍挂载，且请求代际/身份代际仍一致。 */
export const shouldWriteAdditionResult = (
  mounted: boolean,
  guardPassed: boolean,
): boolean => mounted && guardPassed

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
 * 已卸载组件的结果一律忽略）；只有 academicPost 已实际清除凭证（
 * credentialInvalidatedHere 标记）才清空显示并呈现重新绑定引导。旧身份/
 * 旧请求返回失效不会影响新身份或新请求。
 */
export const classifyAdditionError = (args: {
  isMounted: boolean
  isCurrentRequest: boolean
  credentialInvalidatedHere: boolean
}): AdditionErrorAction => {
  if (!args.isMounted || !args.isCurrentRequest) return 'stale_ignored'
  if (args.credentialInvalidatedHere) return 'credential_invalidated'
  return 'present_error'
}
