import type { CampusCirclePostView, CampusCircleTopicView } from '../../api/types'
import { apiDateTimeCampusParts } from '../../utils/date-time'

export const parsePositiveId = (value: unknown) => {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : 0
}

export const communityTopicPublisherUrl = (topicId: number) => (
  `/pages/publish/index?section=community&community_topic_id=${parsePositiveId(topicId)}`
)

export const communityTopicUrl = (topicId: number) => {
  const id = parsePositiveId(topicId)
  return id ? `/pages/community/topic/index?id=${id}` : ''
}

type CommunityPostTopicSummary = NonNullable<
  NonNullable<CampusCirclePostView['topics']>[number]['topic']
>

export const communityPostTopics = (
  post: Pick<CampusCirclePostView, 'topics' | 'primary_topic' | 'topic'>,
): CommunityPostTopicSummary[] => {
  const topics: CommunityPostTopicSummary[] = []
  const seen = new Set<number>()
  ;(post.topics || []).forEach((association) => {
    const topic = association.topic
    if (!topic || topic.id <= 0 || seen.has(topic.id)) return
    seen.add(topic.id)
    topics.push(topic)
  })
  const fallback = post.primary_topic || post.topic
  if (topics.length === 0 && fallback && fallback.id > 0) topics.push(fallback)
  return topics
}

const communityTopicNamePattern = /#([A-Za-z0-9_\u4e00-\u9fff]{1,32})/gu

/**
 * Extracts at most three inline hashtags for the post association API.
 * Explicitly selected topics remain the source of truth for the primary topic;
 * these names only allow the server to resolve aliases or create a safe topic.
 */
export const extractCommunityTopicNames = (content: string) => {
  const names: string[] = []
  const seen = new Set<string>()
  let match: RegExpExecArray | null = communityTopicNamePattern.exec(content)
  while (match && names.length < 3) {
    const start = match.index
    const previous = start > 0 ? content[start - 1] : ''
    if (!/[A-Za-z0-9_/]/u.test(previous)) {
      const name = match[1]
      const key = name.toLocaleLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        names.push(name)
      }
    }
    match = communityTopicNamePattern.exec(content)
  }
  communityTopicNamePattern.lastIndex = 0
  return names
}

const formatTopicDate = (value: string) => {
  const parts = apiDateTimeCampusParts(value)
  if (!parts) return value
  return `${parts.month}月${parts.day}日`
}

export const topicPeriodLabel = (
  topic: Pick<CampusCircleTopicView, 'kind' | 'starts_at' | 'ends_at'>,
) => {
  if (topic.kind !== 'campaign') return ''
  if (topic.starts_at && topic.ends_at) {
    return `${formatTopicDate(topic.starts_at)}至${formatTopicDate(topic.ends_at)}`
  }
  if (topic.starts_at) return `${formatTopicDate(topic.starts_at)}开始`
  if (topic.ends_at) return `${formatTopicDate(topic.ends_at)}结束`
  return '活动时间待公布'
}
