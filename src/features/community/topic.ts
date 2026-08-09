import type { CampusCircleTopicView } from '../../api/types'

export const parsePositiveId = (value: unknown) => {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : 0
}

export const communityTopicPublisherUrl = (topicId: number) => (
  `/pages/publish/index?section=community&community_topic_id=${parsePositiveId(topicId)}`
)

const formatTopicDate = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.getMonth() + 1}月${date.getDate()}日`
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
