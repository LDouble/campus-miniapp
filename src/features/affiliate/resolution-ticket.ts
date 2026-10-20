import { isApiError } from '../../api/client'
import type { AffiliateGoods } from '../../api/affiliate'

/** AffiliateResolutionGoods 仅在当前小程序进程中关联本次解析的短期转链凭证。 */
export type AffiliateResolutionGoods = AffiliateGoods & {
  resolution_token?: string | null
  requires_resolution_token?: boolean
}

/** AffiliateResolutionTicketFailure 表示服务端拒绝了当前解析凭证的原因。 */
export type AffiliateResolutionTicketFailure = 'expired' | 'changed'

/** getAffiliateResolutionTicketFailure 识别需要重新粘贴商品内容的解析凭证错误。 */
export const getAffiliateResolutionTicketFailure = (
  error: unknown,
): AffiliateResolutionTicketFailure | null => {
  if (!isApiError(error)) return null
  if (error.code === 'affiliate_resolution_expired') return 'expired'
  if (error.code === 'affiliate_resolution_changed') return 'changed'
  return null
}

/** getAffiliateResolutionTicketMessage 为失效凭证提供可执行的重试指引。 */
export const getAffiliateResolutionTicketMessage = (
  failure: AffiliateResolutionTicketFailure | 'missing',
) => {
  if (failure === 'changed') return '商品内容已变化，请重新粘贴淘宝商品链接或淘口令。'
  if (failure === 'missing') return '本次解析没有可用的推广凭证，请重新粘贴淘宝商品链接或淘口令。'
  return '解析凭证已失效，请重新粘贴淘宝商品链接或淘口令。'
}
