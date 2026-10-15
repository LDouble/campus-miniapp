import type { AffiliateConvertResult } from '../../api/affiliate'
import type { AffiliatePurchaseProduct } from './components/product-card'

const normalizeAmount = (value: string | null | undefined) => {
  if (value == null || value.trim() === '') return null
  const amount = Number(value)
  return Number.isFinite(amount) ? String(amount) : value.trim()
}

/** 判断转链结果是否过期；无过期时间表示由服务端管理有效期。 */
export const isAffiliateLinkExpired = (expiresAt: string | null, now = Date.now()) => {
  if (!expiresAt) return false
  const timestamp = Date.parse(expiresAt)
  return !Number.isFinite(timestamp) || timestamp <= now
}

/** 比较页面展示的旧优惠与转链时服务端返回的新优惠。 */
export const hasAffiliateOfferChanged = (
  product: AffiliatePurchaseProduct,
  result: AffiliateConvertResult,
) => {
  const priceChanged = product.actual_price != null
    && normalizeAmount(product.actual_price) !== normalizeAmount(result.actual_price)
  const couponStatusChanged = product.coupon_status !== result.coupon_status
  const couponAmountChanged = product.coupon_amount != null
    && normalizeAmount(product.coupon_amount) !== normalizeAmount(result.coupon_amount)
  const couponConditionChanged = product.coupon_condition != null
    && product.coupon_condition.trim() !== (result.coupon_condition?.trim() || '')

  return priceChanged || couponStatusChanged || couponAmountChanged || couponConditionChanged
}
