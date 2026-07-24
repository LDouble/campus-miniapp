import Taro from '@tarojs/taro'

/**
 * The WeChat runtime owns one custom tabBar instance per tab page.
 * Set the active item from the page that owns the instance instead of
 * relying on a shared component's initial data.
 */
export function syncCustomTabBar (selected: number) {
  const page = Taro.getCurrentInstance().page as any
  page?.getTabBar?.()?.setData({ selected })
}
