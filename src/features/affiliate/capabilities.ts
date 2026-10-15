import { getClientBootstrap } from '../../api/client-bootstrap'
import type { ClientBootstrap } from '../../api/types'
import {
  DISABLED_AFFILIATE_CAPABILITIES,
  hasAffiliateCapabilitiesChanged,
  normalizeAffiliateCapabilities,
  type AffiliateCapabilities,
} from './capability-policy'
import { clearAffiliateGoodsCache } from './session-cache'

export type AffiliateCapabilitySnapshot = {
  loaded: boolean
  capabilities: AffiliateCapabilities
  revision: number
}

type AffiliateCapabilityListener = (snapshot: AffiliateCapabilitySnapshot) => void

const listeners = new Set<AffiliateCapabilityListener>()
let snapshot: AffiliateCapabilitySnapshot = {
  loaded: false,
  capabilities: { ...DISABLED_AFFILIATE_CAPABILITIES },
  revision: 0,
}

const updateSnapshot = (value: ClientBootstrap['affiliate'] | null | undefined) => {
  const capabilities = normalizeAffiliateCapabilities(value)
  const changed = !snapshot.loaded
    || hasAffiliateCapabilitiesChanged(snapshot.capabilities, capabilities)
  if (!changed) return snapshot

  snapshot = {
    loaded: true,
    capabilities,
    revision: snapshot.revision + 1,
  }
  clearAffiliateGoodsCache()
  listeners.forEach((listener) => listener(snapshot))
  return snapshot
}

/** getAffiliateCapabilitySnapshot 返回最近一次 bootstrap 得到的 capability 快照。 */
export const getAffiliateCapabilitySnapshot = () => snapshot

/** seedAffiliateCapabilities 将现有 bootstrap 响应合并进 capability 状态。 */
export const seedAffiliateCapabilities = (value: ClientBootstrap['affiliate'] | null | undefined) => (
  updateSnapshot(value)
)

/** refreshAffiliateCapabilities 复用 session bootstrap 缓存，并对缺失或失败状态安全关闭。 */
export const refreshAffiliateCapabilities = async (options: { force?: boolean } = {}) => {
  try {
    const bootstrap = await getClientBootstrap(options)
    return updateSnapshot(bootstrap.affiliate)
  } catch {
    return updateSnapshot(undefined)
  }
}

/** subscribeAffiliateCapabilities 订阅开关快照变化并返回取消订阅函数。 */
export const subscribeAffiliateCapabilities = (listener: AffiliateCapabilityListener) => {
  listeners.add(listener)
  listener(snapshot)
  return () => { listeners.delete(listener) }
}
