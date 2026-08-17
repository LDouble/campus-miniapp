import { getAcademicVerificationStatus } from '../../api/academic-verification'
import { openAcademicVerification } from '../academic-verification/guard'

export const hasVerifiedAcademicIdentity = async () => {
  const status = await getAcademicVerificationStatus({ force: true })
  return status.identity?.status === 'verified'
}

export const ensureClubEditorAccess = async () => {
  try {
    if (await hasVerifiedAcademicIdentity()) return true
  } catch {
    // 登录和网络错误由调用页或底层登录流程处理；认证引导仍是安全兜底。
  }
  await openAcademicVerification({ prompt: true })
  return false
}
