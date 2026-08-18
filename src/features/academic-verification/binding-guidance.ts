import Taro from '@tarojs/taro'
import { AcademicCredentialMissingError } from '../../api/academic-credential'
import { isApiError } from '../../api/client'
import { isMissingAcademicVerificationStatus } from './missing-status'

export const academicBindingGuidance = {
  title: '还没有绑定教务账号',
  message: '绑定后即可查询课表、成绩、考试、选课和课程通过率。',
  actionLabel: '去绑定教务账号',
} as const

export const isAcademicBindingRequiredError = (error: unknown) => (
  error instanceof AcademicCredentialMissingError
  || (
    isApiError(error)
    && (
      error.code === 'academic_verification_required'
      || isMissingAcademicVerificationStatus(error.statusCode, error.code)
    )
  )
)

export const openAcademicCredentialBinding = () => (
  Taro.navigateTo({ url: '/pages/academic-verification/index?rebind=1' })
    .catch(() => Taro.showToast({ title: '暂时无法打开账号绑定页', icon: 'none' }))
)
