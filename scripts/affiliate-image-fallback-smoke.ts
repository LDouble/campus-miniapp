import { strict as assert } from 'node:assert'
import { createAffiliateImageFallbackState } from '../src/features/affiliate/image-fallback'
import { getAffiliateProductDetailMetadata } from '../src/features/affiliate/detail-metadata'

const image = createAffiliateImageFallbackState()

const firstToken = image.select('product:41|https://img.example/first.jpg')
assert.equal(image.isFailed(firstToken), false)
assert.equal(image.markFailed(firstToken), true)
assert.equal(image.isFailed(firstToken), true, '图片加载失败后应切换到占位状态')

const sameSourceToken = image.select('product:41|https://img.example/first.jpg')
assert.equal(sameSourceToken, firstToken)
assert.equal(image.isFailed(sameSourceToken), true)

const changedUrlToken = image.select('product:41|https://img.example/second.jpg')
assert.notEqual(changedUrlToken, firstToken)
assert.equal(image.isFailed(changedUrlToken), false, 'URL 改变后应重新显示图片')
assert.equal(image.markFailed(firstToken), false, '旧 URL 的延迟失败事件不得污染新图片')
assert.equal(image.isFailed(changedUrlToken), false)

const changedProductToken = image.select('product:42|https://img.example/second.jpg')
assert.notEqual(changedProductToken, changedUrlToken)
assert.equal(image.isFailed(changedProductToken), false, '切换商品后应重置图片失败状态')
assert.equal(image.markFailed(changedUrlToken), false, '旧商品的延迟失败事件不得污染新商品')

const returnedToken = image.select('product:41|https://img.example/first.jpg')
assert.notEqual(returnedToken, firstToken)
assert.equal(image.isFailed(returnedToken), false, '离开后重新进入同一商品也应重新尝试图片')

assert.deepEqual(getAffiliateProductDetailMetadata({ coupon_end_at: null, snapshot_at: null }), [])
assert.deepEqual(getAffiliateProductDetailMetadata({ coupon_end_at: '  ', snapshot_at: undefined }), [])
assert.deepEqual(
  getAffiliateProductDetailMetadata({
    coupon_end_at: '2026-11-01T12:34:00+08:00',
    snapshot_at: '2026-10-30T08:09:00+08:00',
  }),
  [
    { key: 'coupon_end_at', label: '优惠券截止', value: '11月01日 12:34' },
    { key: 'snapshot_at', label: '数据更新时间', value: '10月30日 08:09' },
  ],
)
console.log('Affiliate image fallback regression checks passed')
