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

export const createAcademicPost = (deps: AcademicPostDeps) => {
  // 工厂闭包状态：请求序号与最新成功序号，用于同 revision 内旧请求保护。
  // 不能每次调用重置——同一 executor 实例的请求共享这组状态。
  let requestSequence = 0
  let latestSuccessSequence = 0

  return async <T>(
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
    const mySequence = ++requestSequence
    try {
      const response = await deps.requestEnvelope<T[]>({ path, data })
      if (deps.getCredentialRevision() === snapshotRevision) {
        latestSuccessSequence = mySequence
      }
      return {
        records: response.data,
        ...(response.cache ? { cache: response.cache } : {}),
        ...(response.scheduleNote !== undefined ? { scheduleNote: response.scheduleNote } : {}),
      }
    } catch (error) {
      if (
        deps.isCredentialInvalidationError(error)
        && deps.getCredentialRevision() === snapshotRevision
        && mySequence > latestSuccessSequence
      ) {
        // 只在凭证代际未变、且本请求比最新成功请求更新时才清除：旧请求
        // 返回失效不能清除已被更新的成功请求证明有效的凭证。
        deps.clearCredential()
        ;(error as { credentialInvalidated?: boolean }).credentialInvalidated = true
      }
      throw error
    }
  }
}
