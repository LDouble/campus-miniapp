import Taro from '@tarojs/taro'
import { isQualificationEdition } from '../features/app-edition'
import type { LifeHubSection } from '../features/life-services/business-theme'
import {
  applyCampusThemeToCurrentPage,
  getCampusTheme,
} from '../features/theme-preference'

export type TabBarPage = 'home' | 'community' | 'messages' | 'profile'

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
    privateUnreadCount?: number
    privateUnreadLabel?: string
  }) => void
}

const getCustomTabBar = () => {
  const instancePage = Taro.getCurrentInstance().page as
    | { getTabBar?: () => CustomTabBarInstance }
    | undefined
  if (instancePage?.getTabBar) return instancePage.getTabBar()

  const pages = Taro.getCurrentPages() as Array<{ getTabBar?: () => CustomTabBarInstance }>
  const page = pages[pages.length - 1]

  return page?.getTabBar?.()
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
  })
}

export function setCustomTabBarHidden(hidden: boolean) {
  getCustomTabBar()?.setData({ hidden })
}

export function setCustomTabBarPublishSection(publishSection: LifeHubSection) {
  getCustomTabBar()?.setData({ publishSection })
}

export function syncPrivateMessageUnreadBadge(count: number) {
  if (isQualificationEdition) return
  const normalized = Math.max(0, Number(count) || 0)
  getCustomTabBar()?.setData({
    privateUnreadCount: normalized,
    privateUnreadLabel: normalized > 99 ? '99+' : String(normalized),
  })
}
