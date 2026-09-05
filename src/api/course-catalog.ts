import { apiRequest } from './client'
import type {
  AcademicEducationLevel,
  MemberCourseCatalogCoursePage,
} from './types'

export type CourseCatalogSearchInput = {
  educationLevel: AcademicEducationLevel
  periodId: string
  courseName?: string
  teacher?: string
  page?: number
  pageSize?: number
}

/**
 * 课程名、课程代码和选课号共用后端的 keyword 条件；教师名是独立过滤条件。
 * 中文模糊匹配和选课号前缀匹配由后端负责，客户端只提交用户输入的原始条件。
 */
export const searchCourseCatalog = (input: CourseCatalogSearchInput) => apiRequest<MemberCourseCatalogCoursePage>({
  path: '/api/v1/course-catalog/courses',
  method: 'GET',
  query: {
    education_level: input.educationLevel,
    period_id: input.periodId,
    keyword: input.courseName?.trim() || undefined,
    teacher: input.teacher?.trim() || undefined,
    page: input.page || 1,
    page_size: input.pageSize || 20,
  },
})
