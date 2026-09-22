import type { AcademicCacheMetadata } from './types'

export type AcademicQueryResult<T> = {
  records: T[]
  cache?: AcademicCacheMetadata
  scheduleNote?: string
}

export const ACADEMIC_CREDENTIAL_INVALIDATION_CODES = [
  'invalid_academic_credentials',
  'academic_password_expired',
  'academic_account_restricted',
] as const

type AcademicRequestBody = {
  student_no: string
  password: string
  period_id?: string
}

export type AcademicPostDeps = {
  getCurrentIdentity: () => Promise<{ user_id: number }>
  loadCredential: (userId: number) => { studentNo: string; password: string }
  getCredentialRevision: () => number
  clearCredential: () => void
  requestEnvelope: <T>(options: { path: string; data: unknown }) => Promise<{
    data: T
    cache?: AcademicCacheMetadata
    scheduleNote?: string
  }>
  isCredentialInvalidationError: (error: unknown) => boolean
}

export const createAcademicPost = (deps: AcademicPostDeps) => async <T>(
  path: string,
  periodId?: string,
): Promise<AcademicQueryResult<T>> => {
  const currentUser = await deps.getCurrentIdentity()
  const credential = deps.loadCredential(currentUser.user_id)
  const data: AcademicRequestBody = {
    student_no: credential.studentNo,
    password: credential.password,
    ...(periodId ? { period_id: periodId } : {}),
  }
  const snapshotRevision = deps.getCredentialRevision()
  try {
    const response = await deps.requestEnvelope<T[]>({ path, data })
    return {
      records: response.data,
      ...(response.cache ? { cache: response.cache } : {}),
      ...(response.scheduleNote !== undefined ? { scheduleNote: response.scheduleNote } : {}),
    }
  } catch (error) {
    if (
      deps.isCredentialInvalidationError(error)
      && deps.getCredentialRevision() === snapshotRevision
    ) {
      // 只在凭证代际未变时清除：旧密码/旧身份请求返回失效时，凭证已被
      // 重新保存（revision 已变），不能清除刚保存的新凭证。
      deps.clearCredential()
      ;(error as { credentialInvalidated?: boolean }).credentialInvalidated = true
    }
    throw error
  }
}
