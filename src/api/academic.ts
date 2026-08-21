import { apiRequest, apiRequestEnvelope, isApiError } from './client'
import { getCurrentIdentity } from './account'
import {
  clearAcademicCredential,
  loadAcademicCredential,
} from './academic-credential'
import type {
  AcademicCourse,
  AcademicCourseSelection,
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

const academicRequestBody = async (periodId?: string): Promise<AcademicRequestBody> => {
  const currentUser = await getCurrentIdentity()
  const credential = loadAcademicCredential(currentUser.user_id)
  return {
    student_no: credential.studentNo,
    password: credential.password,
    ...(periodId ? { period_id: periodId } : {}),
  }
}

export type AcademicQueryResult<T> = {
  records: T[]
  cache?: AcademicCacheMetadata
  scheduleNote?: string
}

const academicPost = async <T>(path: string, periodId?: string): Promise<AcademicQueryResult<T>> => {
  const data = await academicRequestBody(periodId)
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
      && [
        'invalid_academic_credentials',
        'academic_password_expired',
        'academic_account_restricted',
      ].includes(error.code)
    ) {
      clearAcademicCredential()
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
