import Taro from '@tarojs/taro'
import { isQualificationEdition } from '../features/app-edition'
import type { LifeHubSection } from '../features/life-services/business-theme'
import {
  applyCampusThemeToCurrentPage,
  getCampusTheme,
} from '../features/theme-preference'

export type TabBarPage = 'home' | 'community' | 'messages' | 'profile'

const TAB_BAR_UNREAD_COUNT_KEY = 'campus.messages.unread-count.v1'

const fullTabIndexes: Record<TabBarPage, number> = {
  home: 0,
  community: 1,
  messages: 2,
  profile: 3,
}

const qualificationTabIndexes: Partial<Record<TabBarPage, number>> = {
  home: 0,
  messages: 1,
  profile: 2,
}

export const tabBarIndex = (page: TabBarPage) => (
  isQualificationEdition
    ? qualificationTabIndexes[page] ?? -1
    : fullTabIndexes[page]
)

interface CustomTabBarInstance {
  setData: (data: {
    selected?: number
    hidden?: boolean
    darkMode?: boolean
    publishSection?: LifeHubSection
    unreadCount?: number
  }) => void
}

type TabBarPageInstance = {
  getTabBar?: () => CustomTabBarInstance
}

const getCustomTabBar = () => {
  const pages = Taro.getCurrentPages() as TabBarPageInstance[]
  const currentPage = pages[pages.length - 1]
  if (currentPage?.getTabBar) return currentPage.getTabBar()

  const page = Taro.getCurrentInstance().page as TabBarPageInstance | undefined
  return page?.getTabBar?.()
}

const normalizeUnreadCount = (value: unknown) => {
  const count = Number(value)
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0
}

const getStoredUnreadCount = () => {
  try {
    return normalizeUnreadCount(Taro.getStorageSync(TAB_BAR_UNREAD_COUNT_KEY))
  } catch {
    return 0
  }
}

/**
 * 微信运行时会为每个 Tab 页创建一个自定义 TabBar 实例。
 * 页面显示时只同步当前页面所属的原生组件实例。
 */
export function syncCustomTabBar(page: TabBarPage) {
  applyCampusThemeToCurrentPage()
  const selected = tabBarIndex(page)
  if (selected < 0) return
  getCustomTabBar()?.setData({
    selected,
    hidden: false,
    darkMode: getCampusTheme() === 'dark',
    unreadCount: getStoredUnreadCount(),
  })
}

export function setCustomTabBarUnreadCount(count: number) {
  const unreadCount = normalizeUnreadCount(count)
  try {
    Taro.setStorageSync(TAB_BAR_UNREAD_COUNT_KEY, unreadCount)
  } catch {
    // TabBar 仍会同步当前实例；存储失败不阻断页面消息状态。
  }
  const sync = () => getCustomTabBar()?.setData({ unreadCount })
  sync()
  Taro.nextTick(sync)
}

export function setCustomTabBarHidden(hidden: boolean) {
  getCustomTabBar()?.setData({ hidden })
}

export function setCustomTabBarPublishSection(publishSection: LifeHubSection) {
  getCustomTabBar()?.setData({ publishSection })
}
