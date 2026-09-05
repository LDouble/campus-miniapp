import { apiRequest } from './client'
import type {
  MemberCourseCatalogGeneralEducationModuleList,
  MemberGeneralEducationCoursePage,
} from './types'

export type GeneralEducationCourseSearchInput = {
  keyword?: string
  moduleId?: number
  page?: number
  pageSize?: number
}

/**
 * 通识模块来自独立的课程关系库，不依赖学期或实际开课目录。
 */
export const listGeneralEducationModules = () => apiRequest<MemberCourseCatalogGeneralEducationModuleList>({
  path: '/api/v1/general-education/modules',
  method: 'GET',
})

/**
 * 查询本科通识课程及其全部模块归属，来源通知历史由服务端一并返回。
 */
export const searchGeneralEducationCourses = (
  input: GeneralEducationCourseSearchInput = {},
) => apiRequest<MemberGeneralEducationCoursePage>({
  path: '/api/v1/general-education/courses',
  method: 'GET',
  query: {
    keyword: input.keyword?.trim() || undefined,
    module_id: input.moduleId || undefined,
    page: input.page || 1,
    page_size: input.pageSize || 20,
  },
})
