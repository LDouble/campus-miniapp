import { strict as assert } from 'node:assert'
import { carouselIntervalMs, carouselSwipeStep, nextCarouselIndex } from '../src/features/today-hot/carousel'

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
process.stdout.write('today hot carousel behavior smoke: ok\n')
