import Taro from '@tarojs/taro'
import { apiRequest, isApiError } from './client'
import { getCurrentUser } from './account'
import {
  AcademicCredentialMissingError,
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
  const currentUser = await getCurrentUser()
  try {
    const credential = loadAcademicCredential(currentUser.user.id)
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

const wait = (milliseconds: number) => new Promise<void>((resolve) => {
  setTimeout(resolve, milliseconds)
})

const retryDelay = (error: unknown) => {
  if (isApiError(error)) {
    if (error.code !== 'academic_provider_busy' || error.statusCode !== 429) return 0
    return (error.retryAfterMs || 3000) + Math.floor(Math.random() * 1000)
  }
  return 700 + Math.floor(Math.random() * 500)
}

const academicPost = async <T>(path: string, periodId?: string) => {
  const data = await academicRequestBody(periodId)
  const request = () => apiRequest<T>({ path, method: 'POST', data })
  try {
    return await request()
  } catch (error) {
    const delay = retryDelay(error)
    if (!delay) throw error
    await wait(delay)
    return request()
  }
}

export const listAcademicPeriods = () => apiRequest<AcademicPeriod[]>({
  path: '/api/v1/academic/periods',
  method: 'POST',
})

export const listAcademicCourses = (periodId: string) => academicPost<AcademicCourse[]>(
  '/api/v1/academic/courses',
  periodId,
)

export const listAcademicGrades = () => academicPost<AcademicGrade[]>(
  '/api/v1/academic/grades',
)

export const listAcademicExams = (periodId: string) => academicPost<AcademicExam[]>(
  '/api/v1/academic/exams',
  periodId,
)

export const listAcademicCourseSelections = (periodId: string) => (
  academicPost<AcademicCourseSelection[]>(
    '/api/v1/academic/course-selections',
    periodId,
  )
)
