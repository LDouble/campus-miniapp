import Taro from '@tarojs/taro'

interface CustomTabBarInstance {
  setData: (data: { selected?: number; hidden?: boolean }) => void
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
export function syncCustomTabBar(selected: number) {
  getCustomTabBar()?.setData({ selected, hidden: false })
}

export function setCustomTabBarHidden(hidden: boolean) {
  getCustomTabBar()?.setData({ hidden })
}
