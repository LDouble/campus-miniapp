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
