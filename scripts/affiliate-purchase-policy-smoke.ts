import { strict as assert } from 'node:assert'
import type { AffiliateConvertResult } from '../src/api/affiliate'
import type { AffiliatePurchaseProduct } from '../src/features/affiliate/components/product-card'
import {
  hasAffiliateOfferChanged,
  isAffiliateLinkExpired,
} from '../src/features/affiliate/purchase-policy'

const baseProduct: AffiliatePurchaseProduct = {
  goods_id: 'goods-1',
  title: '测试商品',
  coupon_status: 'active',
  availability: 'valid',
  actual_price: '19.90',
  coupon_amount: '5',
  coupon_condition: '满 20 元可用',
}

const baseResult: AffiliateConvertResult = {
  goods_id: 'goods-1',
  coupon_status: 'active',
  share_url: 'https://example.com/share',
  coupon_url: 'https://example.com/coupon',
  taobao_password: '口令',
  coupon_amount: '5.00',
  coupon_condition: '满 20 元可用',
  actual_price: '19.90',
  expires_at: null,
}

const now = Date.parse('2026-10-15T12:00:00.000Z')
assert.equal(isAffiliateLinkExpired(null, now), false)
assert.equal(isAffiliateLinkExpired('2026-10-15T12:00:01.000Z', now), false)
assert.equal(isAffiliateLinkExpired('2026-10-15T12:00:00.000Z', now), true)
assert.equal(isAffiliateLinkExpired('2026-10-15T11:59:59.000Z', now), true)
assert.equal(isAffiliateLinkExpired('invalid-date', now), true)

assert.equal(hasAffiliateOfferChanged(baseProduct, baseResult), false)
assert.equal(hasAffiliateOfferChanged(baseProduct, { ...baseResult, actual_price: '18.90' }), true)
assert.equal(hasAffiliateOfferChanged(baseProduct, { ...baseResult, coupon_amount: '4.00' }), true)
assert.equal(hasAffiliateOfferChanged(baseProduct, { ...baseResult, coupon_condition: '满 30 元可用' }), true)
for (const couponStatus of ['sold_out', 'expired', 'none', 'unknown'] as const) {
  assert.equal(
    hasAffiliateOfferChanged(baseProduct, { ...baseResult, coupon_status: couponStatus }),
    true,
    `active → ${couponStatus} must require offer confirmation even when amounts match`,
  )
}
assert.equal(
  hasAffiliateOfferChanged({ ...baseProduct, actual_price: undefined }, baseResult),
  false,
  '旧页面没有金额时不应虚构成金额变更',
)

console.log('affiliate purchase policy smoke passed')
