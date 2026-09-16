import { strict as assert } from 'node:assert'
import { carouselIntervalMs, carouselSwipeStep, nextCarouselIndex } from '../src/features/today-hot/carousel'
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
