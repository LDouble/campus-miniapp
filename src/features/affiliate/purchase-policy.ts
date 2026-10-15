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

/** AffiliatePurchaseCopyOutcome 表示确认与复制流程的最终状态。 */
export type AffiliatePurchaseCopyOutcome = 'copied' | 'cancelled' | 'stale' | 'refreshed' | 'refreshed-expired' | 'unavailable'

type AffiliatePurchaseCopyWorkflow = {
  result: AffiliateConvertResult
  requiresConfirmation: boolean
  isCurrent: () => boolean
  confirm: () => Promise<boolean>
  refresh: () => Promise<AffiliateConvertResult | null>
  onRefreshed: () => void
  onRefreshExpired: () => void
  copy: (result: AffiliateConvertResult) => Promise<boolean>
}

/** runAffiliatePurchaseCopyWorkflow 在每个异步边界核验代次与有效期，过期刷新后必须由用户再次确认。 */
export const runAffiliatePurchaseCopyWorkflow = async (
  workflow: AffiliatePurchaseCopyWorkflow,
): Promise<AffiliatePurchaseCopyOutcome> => {
  const refreshExpiredResult = async (): Promise<AffiliatePurchaseCopyOutcome> => {
    const refreshed = await workflow.refresh()
    if (!refreshed || !workflow.isCurrent()) return 'stale'
    if (isAffiliateLinkExpired(refreshed.expires_at)) {
      workflow.onRefreshExpired()
      return 'refreshed-expired'
    }
    workflow.onRefreshed()
    return 'refreshed'
  }

  if (!workflow.isCurrent()) return 'stale'
  if (isAffiliateLinkExpired(workflow.result.expires_at)) return refreshExpiredResult()

  if (workflow.requiresConfirmation && !(await workflow.confirm())) return 'cancelled'

  if (!workflow.isCurrent()) return 'stale'
  if (isAffiliateLinkExpired(workflow.result.expires_at)) return refreshExpiredResult()
  if (!workflow.isCurrent()) return 'stale'

  const copied = await workflow.copy(workflow.result)
  if (!copied) return 'unavailable'
  return workflow.isCurrent() ? 'copied' : 'stale'
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
