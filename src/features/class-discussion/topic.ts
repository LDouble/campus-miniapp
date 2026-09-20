import { parsePositiveId } from '../community/topic'

export const classQuickQuestions = [
  { id: 'attendance', icon: '🙋', label: '点名了吗？', content: '请问这节课点名或签到了吗？' },
  { id: 'homework', icon: '📚', label: '有作业吗？', content: '请问这门课最近布置了哪些作业？提交时间和要求是什么？' },
  { id: 'materials', icon: '📑', label: '求课件资料', content: '想找这门课的课件或复习资料，有同学方便分享吗？' },
] as const

export type ClassQuickQuestionId = typeof classQuickQuestions[number]['id'] | 'free'

export const classQuickQuestionContent = (id?: string) => (
  classQuickQuestions.find((item) => item.id === id)?.content || ''
)

export const withClassQuickQuestionDraft = <T extends { content: string; images: unknown[] }>(
  draft: T,
  question?: string,
): T => {
  const content = classQuickQuestionContent(question)
  return content && !draft.content.trim() && draft.images.length === 0
    ? { ...draft, content }
    : draft
}

export const classDiscussionDraftKey = (topicId: number) => `community:class:${topicId}`

export const classDiscussionTopicPublisherUrl = (topicId: number, question?: ClassQuickQuestionId) => {
  const id = parsePositiveId(topicId)
  return id
    ? `/pages/publish/index?section=community&community_topic_id=${id}&class_discussion_topic_id=${id}${question ? `&class_question=${question}` : ''}`
    : ''
}
