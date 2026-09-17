import { parsePositiveId } from '../community/topic'

export const classDiscussionTopicPublisherUrl = (topicId: number) => {
  const id = parsePositiveId(topicId)
  return id
    ? `/pages/publish/index?section=community&community_topic_id=${id}&class_discussion_topic_id=${id}`
    : ''
}
