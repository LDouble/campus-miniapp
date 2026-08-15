import type { AcademicEducationLevel } from '../../api/academic-credential'

export type CredentialRejectionReason = 'invalid_credentials' | 'password_expired'

export type AcademicCredentialAttempt = {
  studentNo: string
  password: string
  educationLevel: AcademicEducationLevel
}

export type RejectedAcademicCredential = AcademicCredentialAttempt & {
  reason: CredentialRejectionReason
}

export const isRepeatedRejectedCredential = (
  rejected: RejectedAcademicCredential | null,
  attempt: AcademicCredentialAttempt,
) => Boolean(
  rejected
  && rejected.studentNo === attempt.studentNo
  && rejected.password === attempt.password
  && rejected.educationLevel === attempt.educationLevel,
)

export const rejectedCredentialHint = (reason: CredentialRejectionReason) => (
  reason === 'password_expired'
    ? '这组信息门户密码已被校方标记为过期，请先修改密码。'
    : '校方明确提示这组信息门户账号或密码不正确，请核对后修改。'
)

export const rejectedCredentialModal = (reason: CredentialRejectionReason) => (
  reason === 'password_expired'
    ? {
      title: '请先修改密码',
      content: '你刚才提交的密码已被校方标记为过期。请先前往中国海洋大学统一身份认证页面修改密码，再返回重试。',
    }
    : {
      title: '请确认信息门户密码',
      content: '这组账号密码刚被校方明确拒绝。请确认填写的是中国海洋大学信息门户密码，而不是微信密码或本小程序账号密码。',
    }
)
