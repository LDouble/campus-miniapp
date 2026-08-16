import type { CampusCircleTopicView } from '../../api/types'
import { apiDateTimeCampusParts } from '../../utils/date-time'

export const parsePositiveId = (value: unknown) => {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : 0
}

export const communityTopicPublisherUrl = (topicId: number) => (
  `/packages/social/publish/index?section=community&community_topic_id=${parsePositiveId(topicId)}`
)

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
