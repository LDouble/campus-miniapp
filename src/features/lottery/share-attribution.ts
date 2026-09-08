import { ensureAccessToken } from '../../api/auth'
import { submitLotteryShareAttribution } from '../../api/lottery'
import {
  getLotteryShareAttributionToken,
  removeLotteryShareAttributionToken,
  saveLotteryShareAttributionToken,
} from '../../api/lottery-share-attribution'

export const saveLotteryShareAttribution = (campaignId: string, token: string) => {
  if (!campaignId || !token) return
  saveLotteryShareAttributionToken(campaignId, token)
}

export const submitStoredLotteryShareAttribution = async (campaignId: string) => {
  const token = getLotteryShareAttributionToken(campaignId)
  if (!campaignId || !token) return null
  try {
    // 访客首次打开时先保留 token；微信登录完成后才让服务端核验注册与归因。
    await ensureAccessToken()
    const result = await submitLotteryShareAttribution(campaignId, token)
    removeLotteryShareAttributionToken(campaignId)
    return result
  } catch {
    // 网络错误保留归因，后续进入活动或登录后仍可重试；服务端负责幂等和过期判断。
    return null
  }
}
