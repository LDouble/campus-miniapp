import { createElement, useEffect } from 'react'
import Taro, { useDidShow, useDidHide, useLaunch } from '@tarojs/taro'
import { View } from '@tarojs/components'
import {
  loadMiniappRuntimeConfig,
  resolveMiniappModule,
} from './features/runtime-config'
import { installGlobalErrorReporting } from './features/error-reporting'
import { installRequestLogging } from './features/request-logging'
import { requestWechatSubscriptionForCurrentPage } from './features/wechat-subscription'
import { registerWechatAiHandoff } from './features/wechat-ai/handoff'
import { installAppUpdate } from './features/app-update'
import { noticesRepository } from './features/notices/repository'
import { initializeSystemState } from './state/system'
import { preloadPublicData } from './state/public-data'
import {
  applyCampusThemeToNativeChrome,
  applyCampusThemeToCurrentPage,
  getCampusTheme,
  initializeCampusTheme,
} from './features/theme-preference'
import {
  resolvePageSubscriptionModule,
  type CurrentMiniappPage,
} from './features/wechat-subscription/module'
import { setCustomTabBarUnreadCount } from './utils/tabbar'
// 全局样式
import './app.scss'

const refreshMessageUnreadCount = async () => {
  try {
    const unread = await noticesRepository.unreadCount()
    setCustomTabBarUnreadCount(unread.count)
  } catch {
    // 登录态或网络暂不可用时保留本地角标，下一次 onShow 会重新校准。
  }
}

function App(props) {
  useLaunch(() => {
    initializeCampusTheme()
    initializeSystemState()
    installAppUpdate()
    void preloadPublicData()
    installRequestLogging()
    if (__CAMPUS_WECHAT_AI_ENABLED__) registerWechatAiHandoff()
  })

  // 可以使用所有的 React Hooks
  useEffect(() => {
    installGlobalErrorReporting()
  }, [])

  // 对应 onShow
  useDidShow(() => {
    applyCampusThemeToCurrentPage(getCampusTheme())
    applyCampusThemeToNativeChrome(getCampusTheme())
    void preloadPublicData()
    void refreshMessageUnreadCount()
    void guardCurrentPage()
  })

  // 对应 onHide
  useDidHide(() => {})

  return createElement(
    View,
    { onClick: requestWechatSubscriptionForCurrentPage },
    props.children,
  )
}

const guardCurrentPage = async () => {
  const pages = Taro.getCurrentPages() as CurrentMiniappPage[]
  const page = pages[pages.length - 1]
  if (!page || page.route === 'pages/feature-unavailable/index') return
  const moduleKey = resolvePageSubscriptionModule(page)
  if (!moduleKey) return
  const config = await loadMiniappRuntimeConfig()
  const module = resolveMiniappModule(config, moduleKey)
  if (module.state === 'enabled') return
  if (module.state === 'maintenance') {
    await Taro.redirectTo({
      url: `/pages/feature-unavailable/index?module=${moduleKey}&message=${encodeURIComponent(
        module.message || '功能维护中，请稍后再试',
      )}`,
    }).catch(() => undefined)
    return
  }
  await Taro.reLaunch({ url: '/pages/index/index' }).catch(() => undefined)
  await Taro.showToast({ title: '该功能暂未开放', icon: 'none' })
}

export default App
