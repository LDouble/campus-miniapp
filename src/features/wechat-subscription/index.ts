import Taro from '@tarojs/taro'
import {
  getMiniappRuntimeConfig,
  type MiniappModuleKey,
  type MiniappRuntimeConfig,
} from '../runtime-config'
import {
  LIFE_HUB_SECTION_STORAGE_KEY,
  resolvePageSubscriptionModule,
  type CurrentMiniappPage,
} from './module'
import { requestWechatSubscription } from './request'

export type SubscriptionPublishSection = 'community' | 'errands' | 'market' | 'carpool'

const publishSectionModules: Record<SubscriptionPublishSection, MiniappModuleKey> = {
  community: 'community',
  errands: 'errand',
  market: 'marketplace',
  carpool: 'carpool',
}

export const requestWechatSubscriptionForModule = (
  moduleKey: MiniappModuleKey,
  config: MiniappRuntimeConfig = getMiniappRuntimeConfig(),
) => requestWechatSubscription(config.subscription_templates[moduleKey])

export const requestWechatSubscriptionForPublishSection = (
  section: SubscriptionPublishSection,
  config?: MiniappRuntimeConfig,
) => {
  requestWechatSubscriptionForModule(publishSectionModules[section], config)
}

export const requestWechatSubscriptionForCurrentPage = () => {
  const pages = Taro.getCurrentPages() as CurrentMiniappPage[]
  let page = pages[pages.length - 1]
  if (!page) return
  if (page.route === 'pages/community/index') {
    try {
      page = {
        ...page,
        options: {
          ...page.options,
          section: String(Taro.getStorageSync(LIFE_HUB_SECTION_STORAGE_KEY) || ''),
        },
      }
    } catch {
      // Storage 不可用时按社区模块处理。
    }
  }
  const moduleKey = resolvePageSubscriptionModule(page)
  if (moduleKey) requestWechatSubscriptionForModule(moduleKey)
}

type PropagationEvent = {
  stopPropagation: () => void
}

// 点击处理器主动停止冒泡时，仍需走当前模块的统一订阅入口。
export const requestWechatSubscriptionAndStopPropagation = (
  event: PropagationEvent,
) => {
  requestWechatSubscriptionForCurrentPage()
  event.stopPropagation()
}
