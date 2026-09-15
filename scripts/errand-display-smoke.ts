import { strict as assert } from 'node:assert'
import {
  formatErrandStatus,
  isErrandAcceptable,
} from '../src/features/life-services/format'

const now = Date.parse('2026-09-15T08:00:00.000Z')
const base = {
  status: 'open',
  review_status: 'approved',
  viewer_relation: 'none',
  deadline: '2099-09-15T09:00:00.000Z',
}

assert.equal(formatErrandStatus(base), '可接单')
assert.equal(isErrandAcceptable(base, now), true)
assert.equal(
  isErrandAcceptable({ ...base, viewer_relation: 'publisher' }, now),
  false,
  '本人发布的任务不可接',
)
assert.equal(
  formatErrandStatus({ ...base, viewer_relation: 'publisher' }),
  '待接单',
)
assert.equal(
  isErrandAcceptable({ ...base, review_status: 'pending_review' }, now),
  false,
)
assert.equal(
  isErrandAcceptable({ ...base, deadline: '2026-09-15T08:00:00.000Z' }, now),
  false,
  '截止时刻不再可接',
)
assert.equal(
  formatErrandStatus({ ...base, deadline: '2026-09-15T00:00:00.000Z' }),
  '已截止',
)
assert.equal(
  formatErrandStatus({ ...base, status: 'delivered', viewer_relation: 'publisher' }),
  '待确认完成',
)
assert.equal(
  formatErrandStatus({ ...base, status: 'delivered', viewer_relation: 'runner' }),
  '已送达，等待对方确认',
)
assert.equal(
  formatErrandStatus({ ...base, status: 'delivered', viewer_relation: 'none' }),
  '已送达',
)

console.log('errand display smoke passed')
