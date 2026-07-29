import Taro from '@tarojs/taro'
import type { CampusCirclePostView } from '../../api/types'

const COMMUNITY_FEED_PIN_KEY = 'campus.community.feedPin.v1'

type StoredCommunityFeedPin = {
  version: 1
  post: CampusCirclePostView
}

export const saveCommunityFeedPin = (post: CampusCirclePostView) => {
  const value: StoredCommunityFeedPin = {
    version: 1,
    post,
  }
  try {
    Taro.setStorageSync(COMMUNITY_FEED_PIN_KEY, value)
  } catch {
    try {
      Taro.removeStorageSync(COMMUNITY_FEED_PIN_KEY)
    } catch {
      // Storage failure should not block navigation to the community feed.
    }
  }
}

export const consumeCommunityFeedPin = () => {
  let stored: StoredCommunityFeedPin | null = null
  try {
    stored = Taro.getStorageSync<StoredCommunityFeedPin | null>(
      COMMUNITY_FEED_PIN_KEY,
    )
  } catch {
    return null
  } finally {
    try {
      Taro.removeStorageSync(COMMUNITY_FEED_PIN_KEY)
    } catch {
      // The value is one-shot even when local storage is temporarily unavailable.
    }
  }

  if (
    stored?.version !== 1
    || !stored.post
    || Number(stored.post.id) <= 0
    || Number(stored.post.section_id) <= 0
  ) {
    return null
  }

  return stored.post
}
