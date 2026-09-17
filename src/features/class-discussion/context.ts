import type {
  CampusCircleClassAnnouncement,
  CampusCircleTopicView,
} from '../../api/types'
import type { Course } from '../../pages/academic/types'

export type ClassDiscussionContext = {
  classNum: string
  periodId: string
  courseName?: string
}

/**
 * 课堂讨论只使用教务下发的选课号和学年学期。缺少任一字段时，不能用课程名猜测。
 */
export const getClassDiscussionContext = (
  course: Pick<Course, 'classNum' | 'periodId' | 'name'>,
): ClassDiscussionContext | null => {
  const classNum = course.classNum?.trim() || ''
  const periodId = course.periodId.trim()
  if (!classNum || !periodId) return null

  const courseName = course.name.trim()
  return {
    classNum,
    periodId,
    ...(courseName ? { courseName: courseName.slice(0, 64) } : {}),
  }
}

export const isClassDiscussionTopic = (
  topic: Pick<CampusCircleTopicView, 'slug'> | null | undefined,
) => Boolean(topic?.slug.startsWith('class-discussion-'))

export const visibleClassDiscussionAnnouncement = (
  topic: CampusCircleTopicView | null | undefined,
): CampusCircleClassAnnouncement | null => (
  isClassDiscussionTopic(topic) && topic?.status === 'active' && topic.announcement?.published
    ? topic.announcement
    : null
)
