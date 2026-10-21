import type { ClientBootstrap } from '../../api/types'

export type AffiliateCapabilities = NonNullable<ClientBootstrap['affiliate']>
export type AffiliateCapability = 'search' | 'resolve' | 'convert'
export type AffiliateTabPage = 'home' | 'community' | 'goods' | 'messages' | 'profile'

/** AffiliateCopyOperationIdentity 标识一次购买链接操作对应的请求、能力快照和商品。 */
export type AffiliateCopyOperationIdentity = {
  requestRevision: number
  capabilityRevision: number
  goodsId: string | null | undefined
  resolutionToken?: string | null
  requiresResolutionToken?: boolean
}

export const DISABLED_AFFILIATE_CAPABILITIES: AffiliateCapabilities = {
  enabled: false,
  search_enabled: false,
  resolve_enabled: false,
  convert_enabled: false,
}

/** normalizeAffiliateCapabilities 缺少或格式错误时按关闭处理，并将子能力绑定到总开关。 */
export const normalizeAffiliateCapabilities = (value: unknown): AffiliateCapabilities => {
  if (!value || typeof value !== 'object') return { ...DISABLED_AFFILIATE_CAPABILITIES }
  const candidate = value as Partial<AffiliateCapabilities>
  const enabled = candidate.enabled === true
  return {
    enabled,
    search_enabled: enabled && candidate.search_enabled === true,
    resolve_enabled: enabled && candidate.resolve_enabled === true,
    convert_enabled: enabled && candidate.convert_enabled === true,
  }
}

/** canUseAffiliateCapability 将各项操作能力统一映射到 bootstrap 的开关。 */
export const canUseAffiliateCapability = (
  capabilities: AffiliateCapabilities,
  capability: AffiliateCapability,
) => {
  if (!capabilities.enabled) return false
  if (capability === 'search') return capabilities.search_enabled
  if (capability === 'resolve') return capabilities.resolve_enabled
  return capabilities.convert_enabled
}

/** isCurrentAffiliateRequest 仅允许当前代且能力未变化的商品请求写入页面。 */
export const isCurrentAffiliateRequest = (
  currentRevision: number,
  capturedRevision: number,
  currentCapabilityRevision: number,
  capturedCapabilityRevision: number,
  capabilities: AffiliateCapabilities,
) => (
  currentRevision === capturedRevision
  && currentCapabilityRevision === capturedCapabilityRevision
  && capabilities.enabled
)

/** applyAffiliateRequestIfCurrent 仅在请求代与能力快照仍有效时提交页面状态。 */
export const applyAffiliateRequestIfCurrent = (
  currentRevision: number,
  capturedRevision: number,
  currentCapabilityRevision: number,
  capturedCapabilityRevision: number,
  capabilities: AffiliateCapabilities,
  apply: () => void,
) => {
  if (!isCurrentAffiliateRequest(
    currentRevision,
    capturedRevision,
    currentCapabilityRevision,
    capturedCapabilityRevision,
    capabilities,
  )) return false
  apply()
  return true
}

/** isCurrentAffiliateCopyOperation 阻止旧商品、旧能力或旧请求继续复制推广内容。 */
export const isCurrentAffiliateCopyOperation = (
  current: AffiliateCopyOperationIdentity,
  captured: AffiliateCopyOperationIdentity,
  capabilities: AffiliateCapabilities,
) => (
  current.requestRevision === captured.requestRevision
  && current.capabilityRevision === captured.capabilityRevision
  && current.goodsId === captured.goodsId
  && current.resolutionToken === captured.resolutionToken
  && current.requiresResolutionToken === captured.requiresResolutionToken
  && current.goodsId !== null
  && current.goodsId !== undefined
  && canUseAffiliateCapability(capabilities, 'convert')
)

/** runAffiliateCopyIfCurrent 通过同一代校验后才执行复制等外部副作用。 */
export const runAffiliateCopyIfCurrent = <T>(
  current: AffiliateCopyOperationIdentity,
  captured: AffiliateCopyOperationIdentity,
  capabilities: AffiliateCapabilities,
  run: () => T,
): T | null => {
  if (!isCurrentAffiliateCopyOperation(current, captured, capabilities)) return null
  return run()
}

/** hasAffiliateCapabilitiesChanged 判断总开关或任一操作权限是否发生变化。 */
export const hasAffiliateCapabilitiesChanged = (
  previous: AffiliateCapabilities,
  next: AffiliateCapabilities,
) => (
  previous.enabled !== next.enabled
  || previous.search_enabled !== next.search_enabled
  || previous.resolve_enabled !== next.resolve_enabled
  || previous.convert_enabled !== next.convert_enabled
)

/** shouldClearAffiliateGoodsCache 保留可展示的商品快照，仅总开关、搜索或解析权限变化时失效。 */
export const shouldClearAffiliateGoodsCache = (
  previous: AffiliateCapabilities,
  next: AffiliateCapabilities,
  previousLoaded: boolean,
) => (
  !previousLoaded
  || previous.enabled !== next.enabled
  || previous.search_enabled !== next.search_enabled
  || previous.resolve_enabled !== next.resolve_enabled
)

/** resolveAffiliateTabIndex 按实际显示的 Tab 列表计算选中索引。 */
export const resolveAffiliateTabIndex = (
  page: AffiliateTabPage,
  qualificationEdition: boolean,
  capabilities: AffiliateCapabilities,
) => {
  const pages: AffiliateTabPage[] = qualificationEdition
    ? ['home', 'goods', 'messages', 'profile']
    : ['home', 'community', 'goods', 'messages', 'profile']
  const visiblePages = pages.filter((item) => item !== 'goods' || capabilities.enabled)
  return visiblePages.indexOf(page)
}
