import { strict as assert } from 'node:assert'
import { getMemberAdPoint, isMemberAdHotspotTap } from '../src/features/member-ad-popup/hotspot'

const rect = { left: 20, top: 30, right: 300, bottom: 180 }
const tap = { start: { x: 100, y: 80 }, startedAt: 1000, cancelled: false }
assert.equal(isMemberAdHotspotTap(tap, { x: 104, y: 82 }, 1250, rect), true)
assert.equal(isMemberAdHotspotTap(tap, { x: 104, y: 82 }, 1701, rect), false, '长按不算短触摸')
assert.equal(isMemberAdHotspotTap(tap, { x: 120, y: 82 }, 1200, rect), false, '明显移动不算点击')
assert.equal(isMemberAdHotspotTap(tap, { x: 320, y: 82 }, 1200, rect), false, '结束点在热区外不算点击')
assert.equal(isMemberAdHotspotTap({ ...tap, start: { x: 10, y: 80 } }, { x: 30, y: 80 }, 1200, rect), false, '起点在热区外不算点击')
assert.equal(isMemberAdHotspotTap({ ...tap, cancelled: true }, { x: 100, y: 80 }, 1200, rect), false, '多指或取消手势不算点击')
assert.equal(isMemberAdHotspotTap(tap, { x: 100, y: 80 }, 900, rect), false, '结束时间早于开始时间无效')
assert.deepEqual(getMemberAdPoint({ clientX: 4, clientY: 8 }), { x: 4, y: 8 })
assert.deepEqual(getMemberAdPoint({ pageX: 6, pageY: 9 }), { x: 6, y: 9 })
assert.equal(getMemberAdPoint(undefined), null)
console.log('member ad hotspot smoke: ok')
