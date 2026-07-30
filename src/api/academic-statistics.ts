import { apiRequest } from './client'
import type {
  AcademicCoursePassRatePage,
  AcademicInstructorPassRatePage,
  AcademicPassRateTrend,
} from './types'

type AcademicCoursePassRateQuery = {
  keyword?: string
  courseCode?: string
  page?: number
  pageSize?: number
}

export const listAcademicCoursePassRates = ({
  keyword = '',
  courseCode = '',
  page = 1,
  pageSize = 20,
}: AcademicCoursePassRateQuery = {}) => (
  apiRequest<AcademicCoursePassRatePage>({
    path: '/api/v1/academic/pass-rates',
    method: 'GET',
    query: {
      ...(keyword.trim() ? { keyword: keyword.trim() } : {}),
      ...(courseCode.trim() ? { course_code: courseCode.trim() } : {}),
      page,
      page_size: pageSize,
    },
  })
)

export const getAcademicCoursePassRate = (courseCode: string) => (
  listAcademicCoursePassRates({
    courseCode,
    page: 1,
    pageSize: 1,
  })
)

export const listAcademicInstructorPassRates = (courseCode: string) => (
  apiRequest<AcademicInstructorPassRatePage>({
    path: '/api/v1/academic/pass-rates/instructors',
    method: 'GET',
    query: {
      course_code: courseCode,
      page: 1,
      page_size: 100,
    },
  })
)

export const getAcademicCoursePassRateTrend = (courseCode: string) => (
  apiRequest<AcademicPassRateTrend>({
    path: '/api/v1/academic/pass-rates/trends',
    method: 'GET',
    query: { course_code: courseCode },
  })
)

export const getAcademicInstructorPassRateTrend = (
  courseCode: string,
  teacherKey: string,
) => (
  apiRequest<AcademicPassRateTrend>({
    path: '/api/v1/academic/pass-rates/instructors/trends',
    method: 'GET',
    query: {
      course_code: courseCode,
      teacher_key: teacherKey,
    },
  })
)
