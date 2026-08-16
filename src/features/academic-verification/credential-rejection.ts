import type { AcademicEducationLevel } from '../../api/academic-credential'

export type CredentialRejectionReason = 'invalid_credentials' | 'password_expired' | 'account_restricted'

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
    ? '密码已过期，请访问 my.ouc.edu.cn 修改密码后再更新本机密码。'
    : reason === 'account_restricted'
      ? '账号已锁定或冻结，请访问 my.ouc.edu.cn 处理账号状态和密码。'
      : '账号或密码不正确，请访问 my.ouc.edu.cn 确认或修改密码。'
)

export const rejectedCredentialModal = (reason: CredentialRejectionReason) => (
  reason === 'password_expired'
    ? {
      title: '请先修改密码',
      content: '校方提示密码已经过期。请访问信息门户 my.ouc.edu.cn 修改密码，再返回更新本机保存的密码。当前凭据不会再次提交。',
    }
    : reason === 'account_restricted'
      ? {
        title: '校方账号已受限',
        content: '这个账号已被校方锁定或冻结。请访问信息门户 my.ouc.edu.cn 处理账号状态并修改密码。当前凭据不会再次提交。',
      }
      : {
        title: '请确认信息门户密码',
        content: '校方拒绝了这组账号密码。请访问信息门户 my.ouc.edu.cn 确认或修改密码，再返回更新本机密码。当前凭据不会再次提交。',
      }
)
