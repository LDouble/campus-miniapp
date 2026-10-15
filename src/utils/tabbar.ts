import Taro from '@tarojs/taro'
import { isQualificationEdition } from '../features/app-edition'
import { getAffiliateCapabilitySnapshot } from '../features/affiliate/capabilities'
import { resolveAffiliateTabIndex } from '../features/affiliate/capability-policy'
import type { LifeHubSection } from '../features/life-services/business-theme'

export type TabBarPage = 'home' | 'community' | 'goods' | 'messages' | 'profile'

const TAB_BAR_NOTICE_UNREAD_COUNT_KEY = 'campus.messages.unread-count.v1'
const TAB_BAR_PRIVATE_UNREAD_COUNT_KEY = 'campus.private-messages.unread-count.v1'

export const tabBarIndex = (page: TabBarPage) => resolveAffiliateTabIndex(
  page,
  isQualificationEdition,
  getAffiliateCapabilitySnapshot().capabilities,
)

interface CustomTabBarInstance {
  setData: (data: {
    selected?: number
    hidden?: boolean
    publishSection?: LifeHubSection
    unreadCount?: number
  }) => void
  publish?: () => void
}

type TabBarPageInstance = {
  getTabBar?: () => CustomTabBarInstance
}

const getCustomTabBar = () => {
  const instancePage = Taro.getCurrentInstance().page as TabBarPageInstance | undefined
  const instanceTabBar = instancePage?.getTabBar?.()
  if (instanceTabBar) return instanceTabBar

  const pages = Taro.getCurrentPages() as TabBarPageInstance[]
  for (let index = pages.length - 1; index >= 0; index -= 1) {
    const tabBar = pages[index].getTabBar?.()
    if (tabBar) return tabBar
  }
  return undefined
}

const normalizeUnreadCount = (value: unknown) => {
  const count = Number(value)
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0
}

const getStoredUnreadCount = () => {
  try {
    return normalizeUnreadCount(Taro.getStorageSync(TAB_BAR_NOTICE_UNREAD_COUNT_KEY))
  } catch {
    return 0
  }
}

const getStoredPrivateUnreadCount = () => {
  try {
    return normalizeUnreadCount(Taro.getStorageSync(TAB_BAR_PRIVATE_UNREAD_COUNT_KEY))
  } catch {
    return 0
  }
}

const getStoredTotalUnreadCount = () => (
  getStoredUnreadCount() + getStoredPrivateUnreadCount()
)

/**
 * 微信运行时会为每个 Tab 页创建一个自定义 TabBar 实例。
 * 页面显示时同步当前页面组件；子路由会回退到页面栈最近的 TabBar。
 */
export function syncCustomTabBar(page: TabBarPage) {
  const selected = tabBarIndex(page)
  if (selected < 0) return
  getCustomTabBar()?.setData({
    selected,
    hidden: false,
    unreadCount: getStoredTotalUnreadCount(),
  })
}

export function setCustomTabBarUnreadCount(count: number) {
  const unreadCount = normalizeUnreadCount(count)
  try {
    Taro.setStorageSync(TAB_BAR_NOTICE_UNREAD_COUNT_KEY, unreadCount)
  } catch {
    // TabBar 仍会同步当前实例；存储失败不阻断页面消息状态。
  }
  const sync = () => getCustomTabBar()?.setData({ unreadCount: getStoredTotalUnreadCount() })
  sync()
  Taro.nextTick(sync)
}

export function setCustomTabBarHidden(hidden: boolean) {
  getCustomTabBar()?.setData({ hidden })
}

export function setCustomTabBarPublishSection(publishSection: LifeHubSection) {
  getCustomTabBar()?.setData({ publishSection })
}

/** 复用自定义 TabBar 上的原有发布入口及其订阅、发布类型与认证流程。 */
export function openCustomTabBarPublish() {
  const tabBar = getCustomTabBar()
  if (!tabBar?.publish) {
    Taro.showToast({ title: '发布入口暂不可用，请稍后重试', icon: 'none' })
    return false
  }
  tabBar.publish()
  return true
}

export function syncPrivateMessageUnreadBadge(count: number) {
  if (isQualificationEdition) return
  const normalized = Math.max(0, Number(count) || 0)
  try {
    Taro.setStorageSync(TAB_BAR_PRIVATE_UNREAD_COUNT_KEY, normalized)
  } catch {
    // 私信角标同步失败时保留当前页面实例状态，不阻断消息页。
  }
  const sync = () => getCustomTabBar()?.setData({ unreadCount: getStoredTotalUnreadCount() })
  sync()
  Taro.nextTick(sync)
}
