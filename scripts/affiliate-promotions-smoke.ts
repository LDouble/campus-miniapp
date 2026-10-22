import { strict as assert } from 'node:assert'
import type { AffiliateConvertResult, AffiliateGoods } from '../src/api/affiliate'
import {
  getAffiliateOfferCountdown,
  getAffiliateConvertedCouponStatusForDisplay,
  getAffiliateConversionDisplay,
  getAffiliateConvertedPrice,
  getAffiliateCouponStatusForDisplay,
  getAffiliateCouponTimeRange,
  getAffiliateOfferBoundaryDelay,
  getAffiliatePurchaseLabel,
  getAffiliatePromotionDisplay,
  getAffiliateReferencePrice,
  getNextAffiliateOfferBoundary,
  hasCurrentAffiliateConvertedCoupon,
  hasCurrentAffiliateCoupon,
  type AffiliateOfferData,
  type AffiliatePromotionData,
} from '../src/features/affiliate/promotions'

const now = Date.parse('2026-10-20T10:00:00+08:00')
const promotion: AffiliatePromotionData = {
  type: 'group_purchase',
  name: '校园秋日聚惠',
  start_at: '2026-10-20T09:00:00+08:00',
  end_at: '2026-10-20T12:00:00+08:00',
  discount_type: 'cross_store_reduction',
  discount_full: '100',
  discount_cut: '20',
}
const couponOffer: AffiliateOfferData = {
  coupon_status: 'active',
  coupon_amount: '10',
  coupon_start_at: '2026-10-20T09:00:00+08:00',
  coupon_end_at: '2026-10-20T11:00:00+08:00',
}

const validPromotion = getAffiliatePromotionDisplay(promotion, now)
assert.equal(validPromotion?.typeLabel, '聚划算', 'group_purchase 展示为聚划算而非拼团')
assert.equal(validPromotion?.title, '校园秋日聚惠', '活动标题使用上游活动名称')
assert.equal(validPromotion?.discountLabel, '跨店满减 满¥100减¥20', '完整真实满减金额分别展示')
assert.match(validPromotion?.timeRange || '', /至/u, '活动详情展示上游有效时间范围')

const oversizeCut = getAffiliatePromotionDisplay({
  ...promotion,
  discount_full: '100',
  discount_cut: '101',
}, now)
assert.equal(oversizeCut?.discountLabel, null, '减免金额大于门槛时不展示异常满减')
assert.equal(getAffiliatePromotionDisplay({ ...promotion, discount_full: null }, now)?.discountLabel, null)
assert.equal(getAffiliatePromotionDisplay({ ...promotion, discount_type: null }, now)?.discountLabel, null)
assert.equal(
  getAffiliatePromotionDisplay({ ...promotion, end_at: '2026-10-20T09:59:59+08:00' }, now),
  null,
  '到期活动不展示',
)
assert.equal(
  getAffiliatePromotionDisplay({ ...promotion, start_at: '2026-10-20T10:00:01+08:00' }, now),
  null,
  '尚未开始的活动不展示',
)
assert.equal(
  getAffiliatePromotionDisplay({ ...promotion, start_at: null } as unknown as AffiliatePromotionData, now),
  null,
  '缺少起始时间的活动不展示',
)
assert.equal(
  getAffiliatePromotionDisplay({ ...promotion, end_at: 'invalid' }, now),
  null,
  '无法解析时间的活动不展示',
)

assert.equal(hasCurrentAffiliateCoupon(couponOffer, now), true, '完整且当前有效的优惠券可用')
assert.equal(getAffiliateCouponTimeRange(couponOffer, now)?.includes('至'), true, '优惠券有效期完整展示')
assert.equal(hasCurrentAffiliateCoupon({ ...couponOffer, coupon_start_at: undefined }, now), false, '缺少开始时间的旧券状态不视为有效')
assert.equal(hasCurrentAffiliateCoupon({ ...couponOffer, coupon_end_at: undefined }, now), false, '缺少结束时间的旧券状态不视为有效')
assert.equal(hasCurrentAffiliateCoupon({ ...couponOffer, coupon_start_at: 'invalid' }, now), false, '开始时间格式错误的券不视为有效')
assert.equal(hasCurrentAffiliateCoupon({ ...couponOffer, coupon_end_at: '2026-10-20T09:59:59+08:00' }, now), false, '过期优惠券不可用')
assert.equal(hasCurrentAffiliateCoupon({ ...couponOffer, coupon_start_at: '2026-10-20T10:00:01+08:00' }, now), false, '未开始优惠券不可用')
assert.equal(hasCurrentAffiliateCoupon({ ...couponOffer, coupon_amount: '0' }, now), false, '零金额券不作为有效优惠券')
assert.equal(
  getAffiliateCouponStatusForDisplay({ ...couponOffer, coupon_end_at: undefined }, now),
  'unknown',
  '缺少券有效期的历史 active 状态降级为待核验',
)
assert.equal(getAffiliatePurchaseLabel(true, true, 'active'), '领券购买', '有效券购买文案准确')
assert.equal(getAffiliatePurchaseLabel(false, true, 'unknown'), '去淘宝购买', '仅活动商品不显示领券文案')
assert.equal(getAffiliatePurchaseLabel(false, false, 'unknown'), '查看优惠', '无活动且优惠待核验时沿用原提示')

assert.deepEqual(
  getAffiliateReferencePrice({ ...couponOffer, coupon_end_at: '2026-10-20T09:59:59+08:00' }, '80', '100', now),
  { value: '100', isCouponPrice: false, canStrikeOriginalPrice: false },
  '已到期优惠券的卡片价格回退商品参考价且取消原价划线',
)
assert.deepEqual(
  getAffiliateReferencePrice({ ...couponOffer, coupon_status: 'unknown' }, '80', '100', now),
  { value: '100', isCouponPrice: false, canStrikeOriginalPrice: false },
  '优惠待核验时不沿用可能陈旧的券后价',
)
assert.deepEqual(
  getAffiliateReferencePrice({ coupon_status: 'none', coupon_amount: null }, '80', '100', now),
  { value: '80', isCouponPrice: false, canStrikeOriginalPrice: true },
  '明确无券的商品可以展示上游商品参考价',
)

const activeConversion: AffiliateConvertResult = {
  goods_id: 'goods-1',
  coupon_status: 'active',
  coupon_amount: '15',
  coupon_condition: '满100可用',
  coupon_url: null,
  actual_price: '85',
  expires_at: '2026-10-20T10:05:00+08:00',
  share_url: null,
  taobao_password: null,
}
assert.equal(hasCurrentAffiliateConvertedCoupon(activeConversion, now), true, '本次转链的有效正金额优惠可直接使用')
assert.deepEqual(
  getAffiliateConvertedPrice(activeConversion, '100', now),
  { value: '85', isCouponPrice: true, canStrikeOriginalPrice: false },
  '本次转链有效优惠展示转链返回的券后价',
)
const activeConversionWithoutPrice: AffiliateConvertResult = {
  ...activeConversion,
  actual_price: null,
}
assert.deepEqual(
  getAffiliateConvertedPrice(activeConversionWithoutPrice, '100', now),
  { value: '100', isCouponPrice: false, canStrikeOriginalPrice: false },
  '有效券缺少券后价时回退商品原价且不把原价称为券后价',
)
assert.deepEqual(
  getAffiliateConvertedPrice(activeConversionWithoutPrice, null, now),
  { value: null, isCouponPrice: false, canStrikeOriginalPrice: false },
  '有效券缺少券后价和商品原价时不编造价格',
)
assert.equal(
  hasCurrentAffiliateConvertedCoupon({ ...activeConversion, expires_at: '2026-10-20T09:59:00+08:00' }, now),
  false,
  '过期转链结果不再声称优惠可用',
)
assert.equal(
  getAffiliateConvertedCouponStatusForDisplay({ ...activeConversion, expires_at: '2026-10-20T09:59:00+08:00' }, now),
  'expired',
  '过期转链结果展示已结束状态',
)
assert.deepEqual(
  getAffiliateConvertedPrice({ ...activeConversion, expires_at: '2026-10-20T09:59:00+08:00' }, '100', now),
  { value: '100', isCouponPrice: false, canStrikeOriginalPrice: false },
  '转链结果过期后不再展示其可能失效的券后价',
)
assert.deepEqual(
  getAffiliateConvertedPrice({ ...activeConversion, coupon_status: 'none', coupon_amount: null }, '100', now),
  { value: '85', isCouponPrice: false, canStrikeOriginalPrice: false },
  '无券转链结果可以用商品参考价但不能称为券后价',
)
const noCouponConversion: AffiliateConvertResult = {
  ...activeConversion,
  coupon_status: 'none',
  coupon_amount: null,
  coupon_condition: null,
  actual_price: '90',
}
const activityConversionDisplay = getAffiliateConversionDisplay(noCouponConversion, '100', validPromotion, now)
assert.equal(activityConversionDisplay.couponActive, false, '有活动但本次转链无券时不声明优惠券可用')
assert.equal(activityConversionDisplay.priceLabel, '活动参考价', '无券活动使用活动参考价标题')
assert.equal(activityConversionDisplay.price.value, '90', '无券活动使用本次转链的商品参考价')
assert.equal(activityConversionDisplay.hint, '打开淘宝后查看活动规则和商品价格，再下单')
const couponConversionDisplay = getAffiliateConversionDisplay(activeConversion, '100', validPromotion, now)
assert.equal(couponConversionDisplay.couponActive, true, '本次转链返回的有效正金额券作为当前优惠权威')
assert.equal(couponConversionDisplay.priceLabel, '参考券后价', '本次有效券使用券后价文案')
assert.equal(couponConversionDisplay.hint, '打开淘宝后按页面提示领取优惠并下单')
const activeCouponWithoutPriceDisplay = getAffiliateConversionDisplay(
  activeConversionWithoutPrice,
  '100',
  validPromotion,
  now,
)
assert.equal(activeCouponWithoutPriceDisplay.couponActive, true, '缺券后价不影响仍有效优惠券的领取状态')
assert.equal(activeCouponWithoutPriceDisplay.couponStatus, 'active', '缺券后价仍保留有效券状态')
assert.equal(activeCouponWithoutPriceDisplay.price.value, '100', '缺券后价时展示原价作为活动参考价')
assert.equal(activeCouponWithoutPriceDisplay.priceLabel, '活动参考价', '缺券后价时活动名称不冒充券后价')
assert.equal(activeCouponWithoutPriceDisplay.hint, '打开淘宝后按页面提示领取优惠并下单')
const activeCouponWithoutAnyPriceDisplay = getAffiliateConversionDisplay(
  activeConversionWithoutPrice,
  null,
  null,
  now,
)
assert.equal(activeCouponWithoutAnyPriceDisplay.couponActive, true, '没有参考价也保留有效券领取状态')
assert.equal(activeCouponWithoutAnyPriceDisplay.price.value, null, '没有券后价和原价时不展示价格')
assert.equal(activeCouponWithoutAnyPriceDisplay.priceLabel, '商品参考价', '没有实际券后价时使用通用价格标题')

const withBoundaries: AffiliateOfferData = {
  ...couponOffer,
  promotion,
}
assert.equal(
  getNextAffiliateOfferBoundary(withBoundaries, now),
  Date.parse('2026-10-20T11:00:00+08:00'),
  '下一个边界按最近券结束时间排序',
)
const switchedOffer: AffiliateGoods = {
  goods_id: 'new-product',
  title: '新商品',
  availability: 'valid',
  coupon_status: 'active',
  coupon_amount: '10',
  coupon_start_at: '2026-10-20T10:30:00+08:00',
  coupon_end_at: '2026-10-20T11:30:00+08:00',
}
assert.equal(
  getNextAffiliateOfferBoundary(switchedOffer, now),
  Date.parse('2026-10-20T10:30:00+08:00'),
  '切换商品后使用新商品的最近边界',
)
assert.equal(
  getAffiliateOfferBoundaryDelay(Date.parse('2026-10-20T09:30:00+08:00'), now),
  1,
  '设备时间已晚于边界时安排即时校准，不用旧状态计算长延迟',
)

console.log('affiliate promotion and coupon validity, labels, amounts, and clock boundaries: ok')

assert.equal(getAffiliateOfferCountdown(couponOffer, now)?.text, '01:00:00')
assert.equal(getAffiliateOfferCountdown(couponOffer, now)?.label, '优惠券到期')
assert.equal(getAffiliateOfferCountdown({ ...couponOffer, promotion }, now)?.label, '活动结束')
assert.equal(getAffiliateOfferCountdown(couponOffer, now + 3600000), null)
assert.equal(getAffiliateOfferCountdown({ ...couponOffer, coupon_end_at: 'invalid' }, now), null)
assert.equal(getAffiliateOfferCountdown(couponOffer, now - 7200000), null)
assert.equal(getAffiliateOfferCountdown(couponOffer, now + 3599999)?.text, '00:00:01')
