import Taro from '@tarojs/taro'
import { apiRequest, isApiError } from '../../api/client'
import type { CampusCircleTopicView } from '../../api/types'
import { isQualificationEdition } from '../app-edition'
import { openMigratedFeaturePage } from '../app-edition/navigation'
import {
  getMiniappRuntimeConfig,
  openMiniappModule,
  resolveMiniappModule,
  type MiniappRuntimeConfig,
} from '../runtime-config'
import type { Course } from '../../pages/academic/types'
import { getClassDiscussionContext } from './context'

const resolvingDiscussionKeys = new Set<string>()

const resolveClassDiscussionTopic = (course: Course) => {
  const context = getClassDiscussionContext(course)
  if (!context) return null
  return apiRequest<CampusCircleTopicView>({
    path: '/api/v1/campus-circle/class-discussions/resolve',
    method: 'POST',
    data: {
      class_num: context.classNum,
      period_id: context.periodId,
      ...(context.courseName ? { course_name: context.courseName } : {}),
    },
  })
}

export const openClassDiscussion = async (
  course: Course,
  config: MiniappRuntimeConfig = getMiniappRuntimeConfig(),
) => {
  const context = getClassDiscussionContext(course)
  if (!context) {
    await Taro.showToast({
      title: '当前课程缺少选课号或学年学期，暂不能进入讨论',
      icon: 'none',
    })
    return false
  }

  const discussionKey = `${context.periodId}:${context.classNum}`
  if (resolvingDiscussionKeys.has(discussionKey)) return false
  resolvingDiscussionKeys.add(discussionKey)

  try {
    if (isQualificationEdition) {
      await openMigratedFeaturePage({ module: 'community' })
      return true
    }

    // 先遵循社区模块开关，避免在入口关闭时创建无人可访问的话题。
    if (resolveMiniappModule(config, 'community').state !== 'enabled') {
      await openMiniappModule('community', '/pages/community/index', { config })
      return false
    }

    const topic = await resolveClassDiscussionTopic(course)
    if (!topic) return false
    return await openMiniappModule(
      'community',
      `/pages/community/topic/index?id=${topic.id}`,
      { config },
    )
  } catch (error) {
    await Taro.showToast({
      title: isApiError(error) ? error.message : '课堂讨论暂时无法打开，请稍后重试',
      icon: 'none',
    })
    return false
  } finally {
    resolvingDiscussionKeys.delete(discussionKey)
  }
}
