import type { AcademicVerificationStatus } from '../../api/types'

const missingAcademicVerificationCodes = new Set([
  'academic_verification_not_found',
  'academic_verification_request_not_found',
  'academic_review_not_found',
  'academic_request_not_found',
  'academic_identity_not_found',
])

export const emptyAcademicVerificationStatus = (): AcademicVerificationStatus => ({
  identity: null,
  latest_request: null,
})

export const isMissingAcademicVerificationStatus = (
  statusCode: number,
  code: string,
) => statusCode === 404 && missingAcademicVerificationCodes.has(code)
