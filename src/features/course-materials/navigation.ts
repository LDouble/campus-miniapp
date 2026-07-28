import Taro from '@tarojs/taro'
import { rememberCourseSuggestion } from './storage'

interface CourseMaterialNavigation {
  courseName: string
  courseCode?: string
  periodId?: string
  action?: 'upload'
}

const query = (context: CourseMaterialNavigation) => {
  const values = {
    courseName: context.courseName,
    courseCode: context.courseCode,
    periodId: context.periodId,
    action: context.action,
  }
  return Object.entries(values)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&')
}

export const openCourseMaterials = (context: CourseMaterialNavigation) => {
  rememberCourseSuggestion({
    name: context.courseName,
    courseCode: context.courseCode,
    periodId: context.periodId,
  })
  return Taro.navigateTo({ url: `/pages/materials/index?${query(context)}` })
}

export const shareCourseMaterials = (
  context: Omit<CourseMaterialNavigation, 'action'>,
) => openCourseMaterials({ ...context, action: 'upload' })
