import { apiRequest } from './client'
import type {
  AcademicEducationLevel,
  MemberCourseCatalogCategoryList,
  MemberCourseCatalogCoursePage,
  MemberCourseCatalogGeneralEducationModuleList,
} from './types'

export type CourseCatalogSearchInput = {
  educationLevel: AcademicEducationLevel
  periodId: string
  courseName?: string
  teacher?: string
  weekday?: number
  section?: number
  courseCategory?: string
  generalEducationModuleId?: number
  page?: number
  pageSize?: number
}

/**
 * 课程名、课程代码和选课号共用后端的 keyword 条件；教师名、星期、节次和课程类别是独立过滤条件。
 * 中文模糊匹配、选课号前缀匹配和课程类别包含匹配由后端负责，客户端只提交用户输入的原始条件。
 */
export const searchCourseCatalog = (input: CourseCatalogSearchInput) => apiRequest<MemberCourseCatalogCoursePage>({
  path: '/api/v1/course-catalog/courses',
  method: 'GET',
  query: {
    education_level: input.educationLevel,
    period_id: input.periodId,
    keyword: input.courseName?.trim() || undefined,
    teacher: input.teacher?.trim() || undefined,
    weekday: input.weekday || undefined,
    section: input.section || undefined,
    course_category: input.courseCategory?.trim() || undefined,
    general_education_module_id: input.generalEducationModuleId || undefined,
    page: input.page || 1,
    page_size: input.pageSize || 20,
  },
})

export const listCourseCatalogCategories = (input: Pick<CourseCatalogSearchInput, 'educationLevel' | 'periodId'>) => (
  apiRequest<MemberCourseCatalogCategoryList>({
    path: '/api/v1/course-catalog/categories',
    method: 'GET',
    query: {
      education_level: input.educationLevel,
      period_id: input.periodId,
    },
  })
)

/**
 * 通识模块选项由服务端按本科课程目录和学期下发，客户端不维护模块名称。
 */
export const listCourseCatalogGeneralEducationModules = (
  input: Pick<CourseCatalogSearchInput, 'educationLevel' | 'periodId'>,
) => apiRequest<MemberCourseCatalogGeneralEducationModuleList>({
  path: '/api/v1/course-catalog/general-education/modules',
  method: 'GET',
  query: {
    education_level: input.educationLevel,
    period_id: input.periodId,
  },
})
