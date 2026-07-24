import Taro, { useReady } from '@tarojs/taro'
import { useState } from 'react'

export interface NavigationMetrics {
  statusBarHeight: number
  navBarHeight: number
  topInset: number
}

const fallback = (): NavigationMetrics => {
  const info = Taro.getWindowInfo()
  const status = info.statusBarHeight || 0
  return { statusBarHeight: status, navBarHeight: 44, topInset: status + 44 }
}

export function useNavigationMetrics () {
  const [metrics, setMetrics] = useState<NavigationMetrics>({ statusBarHeight: 0, navBarHeight: 44, topInset: 44 })
  useReady(() => {
    const info = Taro.getWindowInfo()
    const status = info.statusBarHeight || 0
    try {
      const capsule = Taro.getMenuButtonBoundingClientRect()
      const gap = Math.max(0, capsule.top - status)
      const nav = 2 * gap + capsule.height
      setMetrics({ statusBarHeight: status, navBarHeight: nav, topInset: status + nav })
    } catch (_) {
      setMetrics(fallback())
    }
  })
  return metrics
}
