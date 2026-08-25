import { strict as assert } from 'node:assert'
import {
  communityTopicPublisherUrl,
  parsePositiveId,
  topicPeriodLabel,
} from '../src/features/community/topic'

assert.equal(parsePositiveId('23'), 23)
assert.equal(parsePositiveId('0'), 0)
assert.equal(parsePositiveId('invalid'), 0)
assert.equal(
  communityTopicPublisherUrl(23),
  '/pages/publish/index?section=community&community_topic_id=23',
)
assert.equal(topicPeriodLabel({ kind: 'topic', starts_at: null, ends_at: null }), '')
assert.equal(
  topicPeriodLabel({
    kind: 'campaign',
    starts_at: '2026-08-10T12:00:00+08:00',
    ends_at: '2026-08-12T12:00:00+08:00',
  }),
  '8月10日至8月12日',
)
assert.equal(
  topicPeriodLabel({ kind: 'campaign', starts_at: null, ends_at: null }),
  '活动时间待公布',
)

console.log('community topic smoke: ok')
