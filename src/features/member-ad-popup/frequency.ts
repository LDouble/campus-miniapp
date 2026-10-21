import { canShowMemberAd } from './policy'

type FrequencyStorage = {
  getStorageSync: (key: string) => unknown
  setStorageSync: (key: string, value: number) => unknown
}

const storageKey = (userId: number) => `campus.member-ad-popup.v1.${userId}`

/** createMemberAdFrequency 按设备和账号管理实际展示时间，不随页面或版本切换重置。 */
export const createMemberAdFrequency = (storage: FrequencyStorage, now = Date.now) => {
  const shownInMemory = new Map<number, number>()
  return {
    isDue(userId: number, roles: readonly string[]) {
      const timestamp = now()
      if (!canShowMemberAd(userId, roles, undefined, timestamp)) return false
      try {
        const stored = storage.getStorageSync(storageKey(userId))
        const memory = shownInMemory.get(userId)
        const lastShownAt = memory === undefined ? stored
          : typeof stored === 'number' && Number.isFinite(stored) && stored > 0
            ? Math.max(memory, stored) : memory
        return canShowMemberAd(userId, roles, lastShownAt, timestamp)
      } catch {
        // 无法读取记录时保守跳过，避免存储异常造成反复弹出。
        return false
      }
    },
    recordShown(userId: number) {
      const timestamp = now()
      if (!Number.isSafeInteger(userId) || userId <= 0
        || !Number.isFinite(timestamp) || timestamp <= 0) return false
      shownInMemory.set(userId, timestamp)
      try {
        storage.setStorageSync(storageKey(userId), timestamp)
        return true
      } catch {
        // 已实际展示，持久化失败时至少保留当前运行期的冷却记录。
        return false
      }
    },
  }
}
