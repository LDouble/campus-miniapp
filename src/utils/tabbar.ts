import Taro from '@tarojs/taro'

const COMMUNITY_TOPIC_KEY = 'pending_community_topic'

/**
 * The WeChat runtime owns one custom tabBar instance per tab page.
 * Set the active item from the page that owns the instance instead of
 * relying on a shared component's initial data.
 */
export function syncCustomTabBar (selected: number) {
  const page = Taro.getCurrentInstance().page as any
  page?.getTabBar?.()?.setData({ selected })
}

export function switchToCommunity (topic = '全部') {
  Taro.setStorageSync(COMMUNITY_TOPIC_KEY, topic)
  return Taro.switchTab({ url: '/pages/community/index' })
}

export function consumeCommunityTopic () {
  const topic = Taro.getStorageSync(COMMUNITY_TOPIC_KEY)
  if (topic) Taro.removeStorageSync(COMMUNITY_TOPIC_KEY)
  return typeof topic === 'string' ? topic : ''
}
