import Taro from '@tarojs/taro'
import { isQualificationEdition } from '../features/app-edition'
import type { LifeHubSection } from '../features/life-services/business-theme'

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
    publishSection?: LifeHubSection
  }) => void
}

const getCustomTabBar = () => {
  const page = Taro.getCurrentInstance().page as
    | { getTabBar?: () => CustomTabBarInstance }
    | undefined

  return page?.getTabBar?.()
}

/**
 * 微信运行时会为每个 Tab 页创建一个自定义 TabBar 实例。
 * 页面显示时只同步当前页面所属的原生组件实例。
 */
export function syncCustomTabBar(page: TabBarPage) {
  const selected = tabBarIndex(page)
  if (selected < 0) return
  getCustomTabBar()?.setData({ selected, hidden: false })
}

export function setCustomTabBarHidden(hidden: boolean) {
  getCustomTabBar()?.setData({ hidden })
}

export function setCustomTabBarPublishSection(publishSection: LifeHubSection) {
  getCustomTabBar()?.setData({ publishSection })
}
