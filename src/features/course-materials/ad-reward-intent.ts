import Taro from '@tarojs/taro'

const AD_REWARD_INTENT_KEY = 'courseMaterials.pendingAdReward.v1'
const AD_REWARD_INTENT_TTL_MS = 2 * 60 * 1000

export interface MaterialAdRewardIntent {
  sessionId: number
  sessionToken: string
  expiresAt: string
  idempotencyKey: string
  createdAt: number
}

/** saveMaterialAdRewardIntent 暂存一次用户主动打开首页广告的奖励会话。 */
export const saveMaterialAdRewardIntent = (intent: Omit<MaterialAdRewardIntent, 'createdAt'>) => {
  Taro.setStorageSync(AD_REWARD_INTENT_KEY, { ...intent, createdAt: Date.now() } satisfies MaterialAdRewardIntent)
}

/** clearMaterialAdRewardIntent 清理未能打开首页的广告奖励意图。 */
export const clearMaterialAdRewardIntent = () => {
  try { Taro.removeStorageSync(AD_REWARD_INTENT_KEY) } catch { /* 清理失败时仍会在读取时检查过期时间。 */ }
}

/** consumeMaterialAdRewardIntent 一次性读取未过期的广告奖励会话。 */
export const consumeMaterialAdRewardIntent = (): MaterialAdRewardIntent | null => {
  let value: unknown
  try {
    value = Taro.getStorageSync<unknown>(AD_REWARD_INTENT_KEY)
    Taro.removeStorageSync(AD_REWARD_INTENT_KEY)
  } catch {
    try { Taro.removeStorageSync(AD_REWARD_INTENT_KEY) } catch { /* 忽略清理失败，入口有有效期校验。 */ }
    return null
  }
  if (!value || typeof value !== 'object') return null
  const intent = value as Partial<MaterialAdRewardIntent>
  if (!Number.isFinite(intent.createdAt) || Date.now() - Number(intent.createdAt) > AD_REWARD_INTENT_TTL_MS) return null
  if (!Number.isSafeInteger(intent.sessionId) || !intent.sessionToken || !intent.expiresAt || !intent.idempotencyKey) return null
  if (new Date(intent.expiresAt).getTime() <= Date.now()) return null
  return intent as MaterialAdRewardIntent
}
