import Taro from '@tarojs/taro'

const storageKey = (campaignId: string) => `campus.lottery.shareAttribution.${campaignId}.v1`

export const saveLotteryShareAttributionToken = (campaignId: string, token: string) => {
  if (!campaignId || !token) return
  Taro.setStorageSync(storageKey(campaignId), token)
}

export const getLotteryShareAttributionToken = (campaignId?: string) => (
  campaignId ? String(Taro.getStorageSync(storageKey(campaignId)) || '') : ''
)

export const removeLotteryShareAttributionToken = (campaignId: string) => {
  if (campaignId) Taro.removeStorageSync(storageKey(campaignId))
}
