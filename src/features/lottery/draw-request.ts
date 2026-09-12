import Taro from '@tarojs/taro'

const STORAGE_KEY_PREFIX = 'campus.lottery.drawRequest.'
const storageKey = (campaignId: string) => `${STORAGE_KEY_PREFIX}${campaignId}.v1`

export const getPendingLotteryDrawKey = (campaignId: string) => (
  campaignId ? String(Taro.getStorageSync(storageKey(campaignId)) || '') : ''
)

export const savePendingLotteryDrawKey = (campaignId: string, key: string) => {
  if (campaignId && key) Taro.setStorageSync(storageKey(campaignId), key)
}

export const clearPendingLotteryDrawKey = (campaignId: string) => {
  if (campaignId) Taro.removeStorageSync(storageKey(campaignId))
}

// 未决幂等键属于登录态；账号退出或被刷新令牌踢下线后绝不能交给下一账号复用。
export const clearAllPendingLotteryDrawKeys = () => {
  Taro.getStorageInfoSync().keys
    .filter((key) => key.startsWith(STORAGE_KEY_PREFIX))
    .forEach((key) => Taro.removeStorageSync(key))
}
