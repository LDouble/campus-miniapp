import Taro from '@tarojs/taro'
import { saveCommunityDetailSnapshot } from '../community/detail-snapshot'
import { reportTodayHotEvent } from './analytics'
import type { CampusCirclePostView } from '../../api/types'

const communityIntentKey = 'campus.todayHot.communityIntent.v1'

type CommunityIntent = {
  version: 1
  createdAt: number
  snapshotId?: number
}

export const openTodayHotCommunity = async (snapshotId?: number) => {
  try {
    const value: CommunityIntent = { version: 1, createdAt: Date.now(), snapshotId }
    Taro.setStorageSync(communityIntentKey, value)
  } catch {
    // 入口仍可直接进入社区，存储失败只会失去一次性上下文。
  }
  reportTodayHotEvent('today_hot_community_cta_click', { snapshotId, source: 'today_hot_feed' })
  await Taro.switchTab({ url: '/pages/community/index' })
}

export const consumeTodayHotCommunityIntent = () => {
  try {
    const value = Taro.getStorageSync<CommunityIntent | null>(communityIntentKey)
    Taro.removeStorageSync(communityIntentKey)
    if (!value || value.version !== 1 || Date.now() - value.createdAt > 5 * 60_000) return null
    return value
  } catch {
    return null
  }
}

export const openTodayHotDetail = (
  post: CampusCirclePostView,
  snapshotId: number,
  source: 'home' | 'today_hot_feed',
) => {
  // 详情页已有内存快照交接，避免首次打开时重复请求；精选页在返回时保留自身滚动位置。
  saveCommunityDetailSnapshot(post)
  return Taro.navigateTo({
    url: `/pages/community/detail?id=${post.id}&mode=post&snapshot=1&today_hot_snapshot=${encodeURIComponent(snapshotId)}&source=${source}`,
  })
}
