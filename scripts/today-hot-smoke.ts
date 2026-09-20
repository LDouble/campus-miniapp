import { readReducedMotion } from '../src/features/today-hot/motion'
import { strict as assert } from 'node:assert'
import { carouselIntervalMs, carouselSwipeStep, nextCarouselIndex, groupDiscussionItems } from '../src/features/today-hot/carousel'
import { consumeTodayHotDetailReturn, saveTodayHotDetailReturn } from '../src/features/today-hot/detail-return'

assert.equal(carouselIntervalMs(0), 5_000)
assert.equal(carouselIntervalMs(3), 4_000)
assert.equal(carouselIntervalMs(12), 10_000)
assert.equal(nextCarouselIndex(0, 1), 0)
assert.equal(nextCarouselIndex(2, 3), 0)
assert.equal(nextCarouselIndex(0, 3, -1), 2)
assert.equal(carouselSwipeStep(-23, 5), 0, 'tiny motion must not switch')
assert.equal(carouselSwipeStep(-100, 5), 0, 'long scroll belongs to page')
assert.equal(carouselSwipeStep(-40, 5), 1)
assert.equal(carouselSwipeStep(40, 5), -1)

const returnedPost = { id: 88, view_count: 6 } as never
saveTodayHotDetailReturn(88, { post: returnedPost })
saveTodayHotDetailReturn(88, { approvedCommentDelta: 1 })
const detailReturn = consumeTodayHotDetailReturn(88)
assert.equal(detailReturn?.post, returnedPost, 'detail like state should return to its original post')
assert.equal(detailReturn?.approvedCommentDelta, 1, 'detail comment delta should accumulate')
assert.equal(consumeTodayHotDetailReturn(88), null, 'detail state is consumed only once')
process.stdout.write('today hot carousel behavior smoke: ok\n')

async function verifySystemSettings() {
  assert.equal(await readReducedMotion(() => ({ reduceMotion: true }), () => false), true)
  assert.equal(await readReducedMotion(() => ({}), () => false), false)
  assert.equal(await readReducedMotion(() => Promise.resolve({ reduce_motion: true }), () => false), true)
  assert.equal(await readReducedMotion(undefined, () => true), true)
  assert.equal(await readReducedMotion(() => { throw new Error('unsupported') }, () => false), false)
  process.stdout.write('today hot platform settings regression: ok\n')
}
void verifySystemSettings().catch((error) => { console.error(error); process.exitCode = 1 })

// 主包和分包入口都应只使用页面内导航，并启用下拉刷新。
;(globalThis as unknown as { definePageConfig: (value: unknown) => unknown }).definePageConfig = (value) => value
for (const path of ['../src/pages/today-hot/index.config', '../src/packages/social/today-hot/index.config']) {
  const config = require(path).default
  assert.equal(config.navigationStyle, 'custom')
  assert.equal(config.enablePullDownRefresh, true)
}

assert.deepEqual(groupDiscussionItems([]), [])
assert.deepEqual(groupDiscussionItems([1]), [[1]])
assert.deepEqual(groupDiscussionItems([1, 2]), [[1, 2]])
assert.deepEqual(groupDiscussionItems([1, 2, 3]), [[1, 2], [3]])
assert.deepEqual(groupDiscussionItems([1, 2, 3, 4]).flat(), [1, 2, 3, 4], '轮播应完整保留服务端顺序且不重复帖子')
