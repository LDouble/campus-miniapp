import Taro from '@tarojs/taro'
import { isQualificationEdition } from '../app-edition'
import { openMigratedFeaturePage } from '../app-edition/navigation'
import { openMiniappModule, type MiniappRuntimeConfig } from '../runtime-config'
import { rememberCourseSuggestion } from './storage'
import {
  discardCourseMaterialNavigationIntent,
  rememberCourseMaterialNavigationIntent,
} from './navigation-intent'
import {
  buildCourseMaterialQuery,
  type CourseMaterialNavigation,
} from './route'

export {
  consumeCourseMaterialNavigationIntent,
  discardCourseMaterialNavigationIntent,
  rememberCourseMaterialNavigationIntent,
} from './navigation-intent'

export {
  buildCourseMaterialQuery,
  type CourseMaterialNavigation,
} from './route'

export interface OpenCourseMaterialsOptions {
  config?: MiniappRuntimeConfig
  requestSubscription?: boolean
}

const removeNavigationIntent = () => {
  discardCourseMaterialNavigationIntent()
}

/** openCourseMaterials 将旧资料入口转换为 Tab 导航并暂存筛选、上传或详情意图。 */
export const openCourseMaterials = async (
  context: CourseMaterialNavigation = {},
  options: OpenCourseMaterialsOptions = {},
) => {
  if (context.courseName) {
    rememberCourseSuggestion({
      name: context.courseName,
      courseCode: context.courseCode,
      periodId: context.periodId,
    })
  }

  if (isQualificationEdition) {
    const query = buildCourseMaterialQuery(context)
    const path = `pages/materials/index${query ? `?${query}` : ''}`
    try {
      await openMigratedFeaturePage({ module: 'course_materials', path })
      return true
    } catch {
      return false
    }
  }

  if (!rememberCourseMaterialNavigationIntent(context)) return false

  try {
    const opened = await openMiniappModule(
      'course_materials',
      '/pages/materials/index',
      {
        tab: true,
        config: options.config,
        subscriptionAlreadyRequested: !options.requestSubscription,
      },
    )
    if (!opened) removeNavigationIntent()
    return opened
  } catch {
    removeNavigationIntent()
    await Taro.showToast({ title: '资料入口暂不可用，请稍后重试', icon: 'none' }).catch(() => undefined)
    return false
  }
}

/** openMyCourseMaterials 打开“我的资料”视图。 */
export const openMyCourseMaterials = (options: OpenCourseMaterialsOptions = {}) => (
  openCourseMaterials({ view: 'mine' }, options)
)

export const shareCourseMaterials = (
  context: Omit<CourseMaterialNavigation, 'action'>,
) => openCourseMaterials({ ...context, action: 'upload' })
