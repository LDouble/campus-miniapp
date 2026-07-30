export interface CourseMaterialNavigation {
  courseName: string
  courseCode?: string
  periodId?: string
  periodLabel?: string
  source?: 'schedule' | 'grades' | 'selection'
  action?: 'upload'
}

export const buildCourseMaterialQuery = (context: CourseMaterialNavigation) => {
  const values = {
    courseName: context.courseName,
    courseCode: context.courseCode,
    periodId: context.periodId,
    periodLabel: context.periodLabel,
    source: context.source,
    action: context.action,
  }
  return Object.entries(values)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&')
}
