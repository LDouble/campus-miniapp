import { apiRequest, apiRequestEnvelope, isApiError } from './client'
import { getCurrentIdentity } from './account'
import {
  clearAcademicCredential,
  getActiveAcademicUserId,
  loadAcademicCredential,
} from './academic-credential'
import type {
  AcademicCourse,
  AcademicCourseSelection,
  AcademicCourseAdditionResult,
  AcademicCalendar,
  AcademicEducationLevel,
  AcademicExam,
  AcademicGrade,
  AcademicPeriod,
  AcademicCacheMetadata,
} from './types'
import { createSharedResource } from '../state/shared-resource'

export const getAcademicCalendar = (educationLevel: AcademicEducationLevel) => (
  apiRequest<AcademicCalendar>({
    path: '/api/v1/academic/calendar',
    method: 'GET',
    query: { education_level: educationLevel },
  })
)

type AcademicRequestBody = {
  student_no: string
  password: string
  period_id?: string
}

export type AcademicQueryResult<T> = {
  records: T[]
  cache?: AcademicCacheMetadata
  scheduleNote?: string
}

const ACADEMIC_CREDENTIAL_INVALIDATION_CODES = [
  'invalid_academic_credentials',
  'academic_password_expired',
  'academic_account_restricted',
] as const

const academicPost = async <T>(path: string, periodId?: string): Promise<AcademicQueryResult<T>> => {
  const currentUser = await getCurrentIdentity()
  const credential = loadAcademicCredential(currentUser.user_id)
  const data: AcademicRequestBody = {
    student_no: credential.studentNo,
    password: credential.password,
    ...(periodId ? { period_id: periodId } : {}),
  }
  const snapshotUserId = currentUser.user_id
  const snapshotStudentNo = credential.studentNo
  try {
    const response = await apiRequestEnvelope<T[]>({ path, method: 'POST', data })
    return {
      records: response.data,
      ...(response.cache ? { cache: response.cache } : {}),
      ...(response.scheduleNote !== undefined ? { scheduleNote: response.scheduleNote } : {}),
    }
  } catch (error) {
    if (
      isApiError(error)
      && (ACADEMIC_CREDENTIAL_INVALIDATION_CODES as readonly string[]).includes(error.code)
    ) {
      // 只在当前活跃凭证仍属于本请求（同 user 同学号）时清除，避免旧身份/
      // 旧请求返回失效时清除已切换的新身份凭证。
      if (getActiveAcademicUserId() === snapshotUserId) {
        try {
          const activeCredential = loadAcademicCredential(snapshotUserId)
          if (activeCredential.studentNo === snapshotStudentNo) {
            clearAcademicCredential()
          }
        } catch {
          // 凭证已不存在，无需清除。
        }
      }
    }
    throw error
  }
}

export const ACADEMIC_PERIODS_FRESH_MS = 30 * 60 * 1000

const academicPeriodsResource = createSharedResource<AcademicPeriod[]>({
  maxAgeMs: ACADEMIC_PERIODS_FRESH_MS,
  group: 'academic',
})

export const listAcademicPeriods = (options: { force?: boolean } = {}) => (
  academicPeriodsResource.ensure(() => apiRequest<AcademicPeriod[]>({
    path: '/api/v1/academic/periods',
    method: 'POST',
  }), options)
)

export const invalidateAcademicPeriods = () => {
  academicPeriodsResource.invalidate()
}

export const listAcademicCourses = (periodId: string) => academicPost<AcademicCourse>(
  '/api/v1/academic/courses',
  periodId,
)

export const listAcademicGrades = () => academicPost<AcademicGrade>(
  '/api/v1/academic/grades',
)

export const listAcademicExams = (periodId: string) => academicPost<AcademicExam>(
  '/api/v1/academic/exams',
  periodId,
)

export const listAcademicCourseSelections = (periodId: string) => (
  academicPost<AcademicCourseSelection>(
    '/api/v1/academic/course-selections',
    periodId,
  )
)

export const listAcademicCourseAdditionResults = (periodId: string) => (
  academicPost<AcademicCourseAdditionResult>(
    '/api/v1/academic/course-addition-results',
    periodId,
  )
)

/** 获取教务系统已选课程的结构化课表；不会修改本地模拟选课草稿。 */
export const listAcademicCourseSelectionSchedule = (periodId: string) => (
  academicPost<AcademicCourse>(
    '/api/v1/academic/course-selection-schedule',
    periodId,
  )
)
