import Taro from '@tarojs/taro'
import type { HomeNotificationGuideRecord } from './notification-guide-policy'

export {
  HOME_NOTIFICATION_GUIDE_COOLDOWN_MS,
  resolveHomeNotificationTemplateIds,
  shouldShowHomeNotificationGuide,
} from './notification-guide-policy'

const storageKeyForUser = (userId: number) => `campus.home.notification-guide.v3.${userId}`

export const readHomeNotificationGuideRecord = (userId: number): HomeNotificationGuideRecord | null => {
  try {
    const value = Taro.getStorageSync(storageKeyForUser(userId)) as Partial<HomeNotificationGuideRecord> | null
    const lastShownAt = Number(value?.lastShownAt)
    return Number.isFinite(lastShownAt) && lastShownAt > 0 ? { lastShownAt } : null
  } catch {
    return null
  }
}

export const saveHomeNotificationGuideRecord = (userId: number, now = Date.now()) => {
  try {
    Taro.setStorageSync(storageKeyForUser(userId), { lastShownAt: now })
  } catch {
    // 本地存储不可用时不阻断首页与订阅设置入口。
  }
}
