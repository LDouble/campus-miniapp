import Taro from '@tarojs/taro'
import { rememberCourseSuggestion } from './storage'
import {
  buildCourseMaterialQuery,
  type CourseMaterialNavigation,
} from './route'

export {
  buildCourseMaterialQuery,
  type CourseMaterialNavigation,
} from './route'

export const openCourseMaterials = (context: CourseMaterialNavigation) => {
  rememberCourseSuggestion({
    name: context.courseName,
    courseCode: context.courseCode,
    periodId: context.periodId,
  })
  return Taro.navigateTo({
    url: `/pages/materials/index?${buildCourseMaterialQuery(context)}`,
  })
}

export const shareCourseMaterials = (
  context: Omit<CourseMaterialNavigation, 'action'>,
) => openCourseMaterials({ ...context, action: 'upload' })
