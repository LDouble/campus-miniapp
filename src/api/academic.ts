import Taro from '@tarojs/taro'
import { apiRequest, apiRequestEnvelope, isApiError } from './client'
import { getCurrentIdentity } from './account'
import {
  AcademicCredentialMissingError,
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
  try {
    const credential = loadAcademicCredential(currentUser.user_id)
    return {
      student_no: credential.studentNo,
      password: credential.password,
      ...(periodId ? { period_id: periodId } : {}),
    }
  } catch (error) {
    if (error instanceof AcademicCredentialMissingError) {
      try {
        await Taro.navigateTo({
          url: '/pages/academic-verification/index?rebind=1',
        })
      } catch {
        // 导航失败时仍抛出明确的凭据错误。
      }
    }
    throw error
  }
}

export type AcademicQueryResult<T> = {
  records: T[]
  cache?: AcademicCacheMetadata
}

const academicPost = async <T>(path: string, periodId?: string): Promise<AcademicQueryResult<T>> => {
  const data = await academicRequestBody(periodId)
  try {
    const response = await apiRequestEnvelope<T[]>({ path, method: 'POST', data })
    return {
      records: response.data,
      ...(response.cache ? { cache: response.cache } : {}),
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

export const listAcademicPeriods = () => apiRequest<AcademicPeriod[]>({
  path: '/api/v1/academic/periods',
  method: 'POST',
})

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
