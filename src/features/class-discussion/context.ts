import type {
  CampusCircleClassAnnouncement,
  CampusCircleTopicView,
} from '../../api/types'
import type { Course } from '../../pages/academic/types'
import type { CourseMaterialNavigation } from '../course-materials/route'

export type ClassDiscussionContext = {
  classNum: string
  periodId: string
  courseName?: string
  courseCode?: string
}

/**
 * 课堂讨论只使用教务下发的选课号和学年学期。缺少任一字段时，不能用课程名猜测。
 */
export const getClassDiscussionContext = (
  course: Pick<Course, 'classNum' | 'periodId' | 'name' | 'courseCode'>,
): ClassDiscussionContext | null => {
  const classNum = course.classNum?.trim() || ''
  const periodId = course.periodId.trim()
  if (!classNum || !periodId) return null

  const courseName = course.name.trim()
  const courseCode = course.courseCode?.trim() || ''
  return {
    classNum,
    periodId,
    ...(courseName ? { courseName: courseName.slice(0, 64) } : {}),
    // 课程代码不是课堂身份的一部分；仅作为课程资料精确匹配的稳定上下文。
    ...(courseCode ? { courseCode } : {}),
  }
}

/**
 * 将服务端课堂元数据转换为资料页上下文。
 *
 * 资料分类先按 courseCode 精确匹配；没有代码或代码未建档时，资料页会保留为
 * 未解析状态，不能仅凭同名课程自动选中其中一个。
 */
export const getClassDiscussionMaterialNavigation = (
  topic: CampusCircleTopicView | null | undefined,
): CourseMaterialNavigation | null => {
  const metadata = topic?.class_discussion
  const courseName = metadata?.course_name.trim() || ''
  const periodId = metadata?.period_id.trim() || ''
  if (!metadata || !courseName || !periodId) return null

  const courseCode = metadata.course_code?.trim() || ''
  return {
    courseName,
    periodId,
    ...(courseCode ? { courseCode } : {}),
    source: 'discussion',
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
