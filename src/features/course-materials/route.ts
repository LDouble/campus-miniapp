export interface CourseMaterialNavigation {
  courseName?: string
  courseId?: number
  courseCode?: string
  periodId?: string
  periodLabel?: string
  sourceType?: 'file' | 'cloud_share'
  materialType?: 'slides' | 'notes' | 'exam' | 'homework' | 'review' | 'other'
  keyword?: string
  source?: 'schedule' | 'grades' | 'selection' | 'exams' | 'discussion'
  action?: 'upload'
  view?: 'mine'
  materialId?: number
}

export const buildCourseMaterialQuery = (context: CourseMaterialNavigation) => {
  const values = {
    courseName: context.courseName,
    courseId: context.courseId,
    courseCode: context.courseCode,
    periodId: context.periodId,
    periodLabel: context.periodLabel,
    sourceType: context.sourceType,
    materialType: context.materialType,
    keyword: context.keyword,
    source: context.source,
    action: context.action,
    view: context.view,
    material_id: context.materialId,
  }
  return Object.entries(values)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&')
}
