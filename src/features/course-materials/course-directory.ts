import type { MaterialCoursePage, MaterialCourseView } from '../../api/types'
import { resolveMaterialCourse } from './validation'

export const materialEducationLevelLabels: Record<MaterialCourseView['education_level'], string> = {
  undergraduate: '本科',
  graduate: '研究生',
  general: '通用',
}

/** 只在服务端检索结果完整时才允许路由上下文自动选课。 */
export const resolveCompleteMaterialCoursePage = (
  page: MaterialCoursePage,
  value: { name?: string; courseCode?: string; educationLevel?: string },
) => (
  page.total <= page.items.length
    ? resolveMaterialCourse(page.items, value)
    : undefined
)

export const coursePickerSelectedIds = (
  target: 'upload' | 'filter' | 'edit',
  uploadCourseIds: number[],
  filterCourseId: number | undefined,
  editCourseIds: number[],
) => {
  if (target === 'edit') return editCourseIds
  if (target === 'filter') return filterCourseId ? [filterCourseId] : []
  return uploadCourseIds
}

export const hasMaterialCourseSelection = (
  courseIds: number[],
  candidateCourseName: string,
) => courseIds.some((id) => Number.isSafeInteger(id) && id > 0)
  || !!candidateCourseName.trim()
