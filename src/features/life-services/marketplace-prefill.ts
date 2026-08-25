import Taro from '@tarojs/taro'
import { requestWechatSubscriptionForModule } from '../wechat-subscription'

export type MarketplaceIntent = 'sell' | 'wanted'
export type MarketplaceSource = 'manual' | 'course_selection' | 'grade' | 'schedule'

export type MarketplacePublishPrefill = {
  intent: MarketplaceIntent
  description: string
  courseName: string
  courseCode: string
  academicPeriodId: string
  academicPeriodLabel: string
  source: MarketplaceSource
}

const PREFILL_KEY = 'campus.marketplace.publish.prefill.v1'
const SEARCH_PREFILL_KEY = 'campus.marketplace.search.prefill.v1'
const LIFE_HUB_SECTION_KEY = 'campus.lifeHub.section.v1'

export type MarketplaceSearchPrefill = MarketplacePublishPrefill & {
  requestId: number
}

export const saveMarketplacePublishPrefill = (
  prefill: MarketplacePublishPrefill,
) => {
  Taro.setStorageSync(PREFILL_KEY, prefill)
}

export const consumeMarketplacePublishPrefill = () => {
  const prefill = Taro.getStorageSync<MarketplacePublishPrefill>(PREFILL_KEY)
  Taro.removeStorageSync(PREFILL_KEY)
  return prefill || null
}

export const consumeMarketplaceSearchPrefill = () => {
  const prefill = Taro.getStorageSync<MarketplaceSearchPrefill>(SEARCH_PREFILL_KEY)
  Taro.removeStorageSync(SEARCH_PREFILL_KEY)
  return prefill || null
}

export const openCourseMarketplacePublisher = (
  prefill: MarketplacePublishPrefill,
) => {
  requestWechatSubscriptionForModule('marketplace')
  saveMarketplacePublishPrefill(prefill)
  return Taro.navigateTo({
    url: `/pages/publish/index?section=market&intent=${prefill.intent}&course_prefill=1`,
  })
}

export const openCourseMarketplaceSearch = (
  prefill: MarketplacePublishPrefill,
) => {
  Taro.setStorageSync(SEARCH_PREFILL_KEY, {
    ...prefill,
    intent: 'wanted',
    requestId: Date.now(),
  } satisfies MarketplaceSearchPrefill)
  Taro.setStorageSync(LIFE_HUB_SECTION_KEY, 'market')
  return Taro.switchTab({ url: '/pages/community/index' })
}
