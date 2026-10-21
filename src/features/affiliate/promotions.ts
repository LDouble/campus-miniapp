import { useEffect, useState } from 'react'
import type { AffiliateConvertResult, AffiliateGoods } from '../../api/affiliate'
import { formatDateTime } from '../life-services/format'
import { compareAffiliateAmounts } from './amount'
import { apiDateTimeTimestamp } from '../../utils/date-time'

export type AffiliatePromotionData = NonNullable<AffiliateGoods['promotion']>

export type AffiliateOfferData = Pick<
  AffiliateGoods,
  'coupon_status' | 'coupon_amount' | 'coupon_start_at' | 'coupon_end_at'
> & {
  promotion?: AffiliatePromotionData | null
}

export type AffiliatePromotionDisplay = {
  typeLabel: string
  title: string
  discountLabel: string | null
  startAt: string
  endAt: string
  timeRange: string
}

export type AffiliateReferencePrice = {
  value?: string | null
  isCouponPrice: boolean
  canStrikeOriginalPrice: boolean
}

export type AffiliateConversionDisplay = {
  couponActive: boolean
  couponStatus: AffiliateGoods['coupon_status']
  price: AffiliateReferencePrice
  priceLabel: string
  hint: string
}

const promotionTypeLabels: Record<string, string> = {
  flash_sale: '限时抢购',
  group_purchase: '聚划算',
  campaign: '活动优惠',
}

const discountTypeLabels: Record<string, string> = {
  shopping_allowance: '购物津贴',
  cross_store_reduction: '跨店满减',
}

const readTimestamp = (value?: string | null) => {
  const timestamp = apiDateTimeTimestamp(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

/** getNextAffiliateOfferBoundary 返回券或活动尚未到达的最近时间边界。 */
export const getNextAffiliateOfferBoundary = (
  offer: AffiliateOfferData | null | undefined,
  now = Date.now(),
) => [
  offer?.promotion?.start_at,
  offer?.promotion?.end_at,
  offer?.coupon_start_at,
  offer?.coupon_end_at,
]
  .map(readTimestamp)
  .filter((timestamp): timestamp is number => timestamp !== null && timestamp > now)
  .sort((left, right) => left - right)[0]

/** getAffiliateOfferBoundaryDelay 使用系统当前时间重新计算边界计时。 */
export const getAffiliateOfferBoundaryDelay = (boundary: number, now = Date.now()) => (
  Math.max(1, Math.min(boundary - now + 50, 2_147_483_647))
)

const formatPositiveAmount = (value?: string | null) => {
  const normalized = value?.trim()
  if (!normalized || !/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null
  const amount = Number(normalized)
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) return null
  return String(amount)
}

/** getAffiliatePromotionDisplay 只展示当前有效且起止时间可核验的结构化活动。 */
export const getAffiliatePromotionDisplay = (
  promotion: AffiliatePromotionData | null | undefined,
  now = Date.now(),
): AffiliatePromotionDisplay | null => {
  if (!promotion) return null
  const typeLabel = promotionTypeLabels[promotion.type]
  const startAt = promotion.start_at?.trim()
  const endAt = promotion.end_at?.trim()
  const startTimestamp = readTimestamp(startAt)
  const endTimestamp = readTimestamp(endAt)
  if (
    !typeLabel
    || !startAt
    || !endAt
    || startTimestamp === null
    || endTimestamp === null
    || startTimestamp >= endTimestamp
    || startTimestamp > now
    || endTimestamp <= now
  ) return null

  const fullAmount = formatPositiveAmount(promotion.discount_full)
  const cutAmount = formatPositiveAmount(promotion.discount_cut)
  const discountTypeLabel = promotion.discount_type
    ? discountTypeLabels[promotion.discount_type]
    : undefined
  const discountLabel = fullAmount
    && cutAmount
    && Number(cutAmount) <= Number(fullAmount)
    && discountTypeLabel
    ? `${discountTypeLabel} 满¥${fullAmount}减¥${cutAmount}`
    : null
  const title = promotion.name?.trim() || typeLabel
  const formattedStartAt = formatDateTime(startAt)
  const formattedEndAt = formatDateTime(endAt)

  return {
    typeLabel,
    title,
    discountLabel,
    startAt: formattedStartAt,
    endAt: formattedEndAt,
    timeRange: `${formattedStartAt} 至 ${formattedEndAt}`,
  }
}

/** hasCurrentAffiliateCoupon 只将有效期完整且当前有效的正金额优惠券视为可用。 */
export const hasCurrentAffiliateCoupon = (offer: AffiliateOfferData, now = Date.now()) => {
  if (offer.coupon_status !== 'active' || !formatPositiveAmount(offer.coupon_amount)) return false

  const startAt = offer.coupon_start_at?.trim()
  const endAt = offer.coupon_end_at?.trim()
  const startTimestamp = startAt ? readTimestamp(startAt) : null
  const endTimestamp = endAt ? readTimestamp(endAt) : null
  return Boolean(
    startAt
    && endAt
    && startTimestamp !== null
    && endTimestamp !== null
    && startTimestamp < endTimestamp
    && startTimestamp <= now
    && endTimestamp > now,
  )
}

/** getAffiliateCouponStatusForDisplay 降级过期、未开始和缺金额的陈旧券状态。 */
export const getAffiliateCouponStatusForDisplay = (
  offer: AffiliateOfferData,
  now = Date.now(),
): AffiliateGoods['coupon_status'] => {
  const status = offer.coupon_status || 'unknown'
  if (status !== 'active' || hasCurrentAffiliateCoupon(offer, now)) return status

  const startTimestamp = readTimestamp(offer.coupon_start_at)
  const endTimestamp = readTimestamp(offer.coupon_end_at)
  if (endTimestamp !== null && endTimestamp <= now) return 'expired'
  if (startTimestamp !== null && startTimestamp > now) return 'not_started'
  return 'unknown'
}

/** getAffiliateCouponTimeRange 只在券当前可用时返回上游提供的真实有效时间。 */
export const getAffiliateCouponTimeRange = (offer: AffiliateOfferData, now = Date.now()) => {
  if (!hasCurrentAffiliateCoupon(offer, now)) return null
  const startAt = offer.coupon_start_at?.trim()
  const endAt = offer.coupon_end_at?.trim()
  if (!startAt || !endAt) return null
  return `有效期 ${formatDateTime(startAt)} 至 ${formatDateTime(endAt)}`
}

/** getAffiliatePurchaseLabel 根据真实优惠状态返回不误导的购买文案。 */
export const getAffiliatePurchaseLabel = (
  couponActive: boolean,
  hasPromotion: boolean,
  couponStatus: AffiliateGoods['coupon_status'],
) => {
  if (couponActive) return '领券购买'
  if (hasPromotion) return '去淘宝购买'
  if (couponStatus === 'unknown' || couponStatus === 'not_started') return '查看优惠'
  return '购买商品'
}

/** getAffiliateReferencePrice 忽略可能残留的失效券后价并避免错误划线。 */
export const getAffiliateReferencePrice = (
  offer: AffiliateOfferData,
  actualPrice?: string | null,
  originalPrice?: string | null,
  now = Date.now(),
): AffiliateReferencePrice => {
  const isCouponPrice = hasCurrentAffiliateCoupon(offer, now) && Boolean(actualPrice)
  const canUseActualPrice = isCouponPrice || offer.coupon_status === 'none'
  const value = canUseActualPrice && actualPrice ? actualPrice : originalPrice
  return {
    value,
    isCouponPrice,
    canStrikeOriginalPrice: Boolean(
      canUseActualPrice
      && actualPrice
      && originalPrice
      && compareAffiliateAmounts(originalPrice, actualPrice) === 1,
    ),
  }
}

/** hasCurrentAffiliateConvertedCoupon 只信任本次转链的正金额状态，并校验链接有效期。 */
export const hasCurrentAffiliateConvertedCoupon = (
  result: AffiliateConvertResult,
  now = Date.now(),
) => {
  if (result.coupon_status !== 'active' || !formatPositiveAmount(result.coupon_amount)) return false
  const expiresAt = result.expires_at?.trim()
  if (!expiresAt) return true
  const expiresTimestamp = readTimestamp(expiresAt)
  return expiresTimestamp !== null && expiresTimestamp > now
}

/** getAffiliateConvertedCouponStatusForDisplay 降级本次转链中已过期或金额异常的券状态。 */
export const getAffiliateConvertedCouponStatusForDisplay = (
  result: AffiliateConvertResult,
  now = Date.now(),
): AffiliateGoods['coupon_status'] => {
  if (result.coupon_status !== 'active' || hasCurrentAffiliateConvertedCoupon(result, now)) return result.coupon_status
  const expiresTimestamp = readTimestamp(result.expires_at)
  return expiresTimestamp !== null && expiresTimestamp <= now ? 'expired' : 'unknown'
}

/** getAffiliateConvertedPrice 显示本次转链的价格，其他状态回退原始商品参考价。 */
export const getAffiliateConvertedPrice = (
  result: AffiliateConvertResult,
  originalPrice?: string | null,
  now = Date.now(),
): AffiliateReferencePrice => {
  const couponActive = hasCurrentAffiliateConvertedCoupon(result, now)
  const hasActualPrice = Boolean(result.actual_price?.trim())
  const isCouponPrice = couponActive && hasActualPrice
  const expiresAt = result.expires_at?.trim()
  const expiresTimestamp = expiresAt ? readTimestamp(expiresAt) : null
  const resultIsCurrent = !expiresAt || (expiresTimestamp !== null && expiresTimestamp > now)
  const canUseResultPrice = resultIsCurrent && ((couponActive && hasActualPrice) || result.coupon_status === 'none')
  return {
    value: canUseResultPrice && result.actual_price ? result.actual_price : originalPrice,
    isCouponPrice,
    canStrikeOriginalPrice: false,
  }
}

/** getAffiliateConversionDisplay 组合转链结果与仍有效的商品活动文案。 */
export const getAffiliateConversionDisplay = (
  result: AffiliateConvertResult,
  originalPrice: string | null | undefined,
  promotion: AffiliatePromotionDisplay | null,
  now = Date.now(),
): AffiliateConversionDisplay => {
  const couponActive = hasCurrentAffiliateConvertedCoupon(result, now)
  const price = getAffiliateConvertedPrice(result, originalPrice, now)
  return {
    couponActive,
    couponStatus: getAffiliateConvertedCouponStatusForDisplay(result, now),
    price,
    priceLabel: price.isCouponPrice ? '参考券后价' : promotion ? '活动参考价' : '商品参考价',
    hint: couponActive
      ? '打开淘宝后按页面提示领取优惠并下单'
      : promotion
      ? '打开淘宝后查看活动规则和商品价格，再下单'
      : '打开淘宝后核对商品价格和购买规则，再下单',
  }
}

/** useAffiliateOfferClock 使用系统当前时间并在活动、优惠券时间边界刷新展示状态。 */
export const useAffiliateOfferClock = (
  offer: AffiliateOfferData | null | undefined,
  refreshKey?: string | number | boolean,
) => {
  const [, setClockRevision] = useState(0)
  const now = Date.now()
  const nextBoundary = getNextAffiliateOfferBoundary(offer, now)

  useEffect(() => {
    if (nextBoundary === undefined) return undefined
    const delay = getAffiliateOfferBoundaryDelay(nextBoundary)
    const timeout = setTimeout(() => setClockRevision((revision) => revision + 1), delay)
    return () => clearTimeout(timeout)
  }, [
    nextBoundary,
    offer?.coupon_end_at,
    offer?.coupon_start_at,
    offer?.promotion?.end_at,
    offer?.promotion?.start_at,
    refreshKey,
  ])

  return now
}

/** getAffiliateOfferCountdown 使用当前有效活动或优惠券的真实截止时间计算剩余时长。 */
export const getAffiliateOfferCountdown = (offer: AffiliateOfferData | null, now = Date.now()) => {
  if (!offer) return null
  const promotion = getAffiliatePromotionDisplay(offer.promotion, now)
  const couponActive = hasCurrentAffiliateCoupon(offer, now)
  const end = promotion ? readTimestamp(offer.promotion?.end_at) : couponActive ? readTimestamp(offer.coupon_end_at) : null
  if (end === null || end <= now) return null
  const seconds = Math.ceil((end - now) / 1000)
  const days = Math.floor(seconds / 86400)
  const pad = (value: number) => String(value).padStart(2, '0')
  return {
    label: promotion ? '活动结束' : '优惠券到期',
    text: `${days ? `${days}天 ` : ''}${pad(Math.floor(seconds / 3600) % 24)}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`,
    end,
  }
}
