import { createElement, useCallback, useEffect, useRef } from 'react'
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
import { isQualificationEdition } from './features/app-edition'
import { refreshPrivateMessageUnreadCount } from './features/direct-messages/unread'
import { canRearmForegroundPrivateMessagePolling } from './features/direct-messages/polling'
// 全局样式
import './app.scss'

function App(props) {
  const privateMessageUnreadTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const privateMessageUnreadVisibleRef = useRef(false)
  const privateMessageUnreadPollingGeneration = useRef(0)

  const stopPrivateMessageUnreadPolling = useCallback(() => {
    if (privateMessageUnreadTimer.current) clearTimeout(privateMessageUnreadTimer.current)
    privateMessageUnreadTimer.current = null
  }, [])

  const schedulePrivateMessageUnreadPolling = useCallback(() => {
    stopPrivateMessageUnreadPolling()
    if (isQualificationEdition || !privateMessageUnreadVisibleRef.current) return
    const generation = privateMessageUnreadPollingGeneration.current
    privateMessageUnreadTimer.current = setTimeout(() => {
      void refreshPrivateMessageUnreadCount().catch(() => undefined).finally(() => {
        if (canRearmForegroundPrivateMessagePolling(
          privateMessageUnreadVisibleRef.current,
          generation,
          privateMessageUnreadPollingGeneration.current,
        )) schedulePrivateMessageUnreadPolling()
      })
    }, 60_000)
  }, [stopPrivateMessageUnreadPolling])

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
    privateMessageUnreadVisibleRef.current = true
    privateMessageUnreadPollingGeneration.current += 1
    const generation = privateMessageUnreadPollingGeneration.current
    applyCampusThemeToCurrentPage(getCampusTheme())
    applyCampusThemeToNativeChrome(getCampusTheme())
    void preloadPublicData()
    void guardCurrentPage()
    if (!isQualificationEdition) {
      void loadMiniappRuntimeConfig().then((config) => {
        if (!canRearmForegroundPrivateMessagePolling(
          privateMessageUnreadVisibleRef.current,
          generation,
          privateMessageUnreadPollingGeneration.current,
        )) return
        if (resolveMiniappModule(config, 'private_message').state !== 'enabled') return
        void refreshPrivateMessageUnreadCount(true).catch(() => undefined)
        schedulePrivateMessageUnreadPolling()
      })
    }
  })

  // 对应 onHide
  useDidHide(() => {
    privateMessageUnreadVisibleRef.current = false
    privateMessageUnreadPollingGeneration.current += 1
    stopPrivateMessageUnreadPolling()
  })

  useEffect(() => () => {
    privateMessageUnreadVisibleRef.current = false
    privateMessageUnreadPollingGeneration.current += 1
    stopPrivateMessageUnreadPolling()
  }, [stopPrivateMessageUnreadPolling])

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
