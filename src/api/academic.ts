import Taro from '@tarojs/taro'
import { apiRequest } from './client'
import { getCurrentUser } from './account'
import {
  AcademicCredentialMissingError,
  loadAcademicCredential,
} from './academic-credential'
import type {
  AcademicCourse,
  AcademicCourseSelection,
  AcademicExam,
  AcademicGrade,
  AcademicPeriod,
} from './types'

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

const academicPost = async <T>(path: string, periodId?: string) => apiRequest<T>({
  path,
  method: 'POST',
  data: await academicRequestBody(periodId),
})

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
