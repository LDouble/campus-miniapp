import Taro from '@tarojs/taro'
import type { CourseMaterialNavigation } from './route'

const MATERIALS_TAB_INTENT_KEY = 'courseMaterials.tabNavigationIntent.v1'
const MATERIALS_TAB_INTENT_TTL_MS = 2 * 60 * 1000

interface StoredCourseMaterialNavigationIntent {
  version: 1
  createdAt: number
  context: CourseMaterialNavigation
}

const hasNavigationIntent = (value: unknown): value is StoredCourseMaterialNavigationIntent => {
  if (!value || typeof value !== 'object') return false
  const intent = value as StoredCourseMaterialNavigationIntent
  return (
    intent.version === 1
    && Number.isFinite(intent.createdAt)
    && !!intent.context
    && typeof intent.context === 'object'
  )
}

/** rememberCourseMaterialNavigationIntent 暂存资料 Tab 下一次展示时要处理的入口意图。 */
export const rememberCourseMaterialNavigationIntent = (
  context: CourseMaterialNavigation,
) => {
  try {
    Taro.setStorageSync(MATERIALS_TAB_INTENT_KEY, {
      version: 1,
      createdAt: Date.now(),
      context,
    } satisfies StoredCourseMaterialNavigationIntent)
    return true
  } catch {
    void Taro.showToast({ title: '无法保存资料入口信息，请重试', icon: 'none' })
    return false
  }
}

export const discardCourseMaterialNavigationIntent = () => {
  try {
    Taro.removeStorageSync(MATERIALS_TAB_INTENT_KEY)
  } catch {
    // 清理失败时，消费入口仍会检查有效期并丢弃过期数据。
  }
}

/** consumeCourseMaterialNavigationIntent 一次性取回资料 Tab 的入口意图。 */
export const consumeCourseMaterialNavigationIntent = (): CourseMaterialNavigation | null => {
  let value: unknown
  try {
    value = Taro.getStorageSync<unknown>(MATERIALS_TAB_INTENT_KEY)
    discardCourseMaterialNavigationIntent()
  } catch {
    discardCourseMaterialNavigationIntent()
    return null
  }

  if (!hasNavigationIntent(value)) return null
  if (Date.now() - value.createdAt > MATERIALS_TAB_INTENT_TTL_MS) return null
  return value.context
}
