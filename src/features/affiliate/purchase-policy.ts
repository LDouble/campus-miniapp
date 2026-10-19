import type { AffiliateConvertResult } from '../../api/affiliate'
import {
  isCurrentAffiliateCopyOperation,
  type AffiliateCopyOperationIdentity,
  type AffiliateCapabilities,
} from './capability-policy'
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

/** AffiliateCopyFallback 保存复制失败后供用户手动选择的文本及其身份。 */
export type AffiliateCopyFallback = {
  text: string
  expiresAt: string | null
  identity: AffiliateCopyOperationIdentity
}

/** isAffiliateCopyFallbackUsable 仅允许当前商品、请求代和能力代的未过期文本进入回退视图。 */
export const isAffiliateCopyFallbackUsable = (
  fallback: AffiliateCopyFallback | null,
  current: AffiliateCopyOperationIdentity,
  capabilities: AffiliateCapabilities,
  now = Date.now(),
) => Boolean(
  fallback
  && fallback.text.trim()
  && isCurrentAffiliateCopyOperation(current, fallback.identity, capabilities)
  && !isAffiliateLinkExpired(fallback.expiresAt, now),
)

/** AffiliatePurchaseCopyOutcome 表示确认与复制流程的最终状态。 */
export type AffiliatePurchaseCopyOutcome = 'copied' | 'cancelled' | 'stale' | 'refreshed' | 'refreshed-expired' | 'unavailable'

/** AffiliateCopySessionIdentity 标识复制流程所属的商品、能力快照和弹层代次。 */
export type AffiliateCopySessionIdentity = {
  generation: number
  goodsId: string | null | undefined
  capabilityRevision: number
  resolutionToken?: string | null
  requiresResolutionToken?: boolean
}

/** AffiliateCopyOperationLock 保存当前复制流程的唯一所有者。 */
export type AffiliateCopyOperationLock = {
  nextOwnerId: number
  owner: { id: number; identity: AffiliateCopySessionIdentity } | null
}

/** createAffiliateCopyOperationLock 创建同步可抢占且代次安全的复制锁。 */
export const createAffiliateCopyOperationLock = (): AffiliateCopyOperationLock => ({
  nextOwnerId: 0,
  owner: null,
})

/** runAffiliateCopyOperationExclusive 为完整复制流程加锁，并只允许所有者释放忙碌状态。 */
export const runAffiliateCopyOperationExclusive = async <T>(
  lock: AffiliateCopyOperationLock,
  identity: AffiliateCopySessionIdentity,
  isCurrentSession: (identity: AffiliateCopySessionIdentity) => boolean,
  onLockChange: (identity: AffiliateCopySessionIdentity | null) => void,
  operation: () => Promise<T>,
): Promise<{ started: boolean; value?: T }> => {
  if (lock.owner && isCurrentSession(lock.owner.identity)) return { started: false }

  const owner = { id: lock.nextOwnerId + 1, identity }
  lock.nextOwnerId = owner.id
  lock.owner = owner
  onLockChange(identity)

  try {
    return { started: true, value: await operation() }
  } finally {
    if (lock.owner?.id === owner.id) {
      lock.owner = null
      onLockChange(null)
    }
  }
}

/** AffiliateConversionIdentity 标识能力刷新后仍可发起转链请求的商品请求。 */
export type AffiliateConversionIdentity = {
  requestRevision: number
  capabilityRevision: number
  goodsId: string | null | undefined
  resolutionToken?: string | null
  requiresResolutionToken?: boolean
}

/** runAffiliateConversionAfterRefresh 只在刷新期间商品、请求和能力代次均未变化时调用转链接口。 */
export const runAffiliateConversionAfterRefresh = async <T, TCapabilities>(options: {
  captured: AffiliateConversionIdentity
  getCurrent: () => AffiliateConversionIdentity
  refreshCapabilities: () => Promise<TCapabilities>
  canConvert: (capabilities: TCapabilities) => boolean
  convert: () => Promise<T>
}): Promise<{ kind: 'converted'; value: T } | { kind: 'stale' } | { kind: 'unavailable' }> => {
  const capabilities = await options.refreshCapabilities()
  const current = options.getCurrent()
  const identityIsCurrent = current.requestRevision === options.captured.requestRevision
    && current.capabilityRevision === options.captured.capabilityRevision
    && current.goodsId === options.captured.goodsId
    && current.resolutionToken === options.captured.resolutionToken
    && current.requiresResolutionToken === options.captured.requiresResolutionToken
    && current.goodsId !== null
    && current.goodsId !== undefined
  if (!identityIsCurrent) return { kind: 'stale' }
  if (!options.canConvert(capabilities)) return { kind: 'unavailable' }
  return { kind: 'converted', value: await options.convert() }
}

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
