export type AcademicDirectErrorCode =
  | 'invalid_credentials'
  | 'password_expired'
  | 'challenge_required'
  | 'identity_mismatch'
  | 'provider_unavailable'
  | 'unsupported'

export class AcademicDirectError extends Error {
  readonly code: AcademicDirectErrorCode

  constructor(code: AcademicDirectErrorCode, message: string) {
    super(message)
    Object.setPrototypeOf(this, AcademicDirectError.prototype)
    this.name = 'AcademicDirectError'
    this.code = code
  }
}

export const academicDirectErrorMessage = (error: unknown) => {
  if (error instanceof AcademicDirectError) return error.message
  return error instanceof Error && error.message
    ? error.message
    : '教务直连暂时不可用'
}
