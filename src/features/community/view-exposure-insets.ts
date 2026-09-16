import { useMemo, useState } from 'react'
import Taro, { useResize } from '@tarojs/taro'
import { getNavbarMetrics } from '../../components/custom-navbar'

export type ViewExposureSurface = 'home' | 'community' | 'topic' | 'profile'

const readInsets = (surface: ViewExposureSurface) => {
  const navbar = getNavbarMetrics()
  let bottomInset = 0
  if (surface === 'home' || surface === 'community') {
    try {
      const window = Taro.getWindowInfo()
      const safeBottom = window.safeArea ? Math.max(0, window.screenHeight - window.safeArea.bottom) : 0
      // 自定义 TabBar 在原生组件内，页面选择器无法穿透其样式隔离。
      bottomInset = 96 * window.windowWidth / 750 + safeBottom
    } catch {
      bottomInset = 48
    }
  }
  return {
    topInset: surface === 'community'
      ? navbar.statusBarHeight
      : navbar.statusBarHeight + navbar.navigationBarHeight,
    bottomInset,
    topOccluderSelector: surface === 'community' ? '.life-hub-navigation' : '.custom-navbar__fixed',
    bottomOccluderSelector: surface === 'topic' ? '.community-topic-page__action-bar' : undefined,
  }
}

export const useViewExposureInsets = (surface: ViewExposureSurface) => {
  const [revision, setRevision] = useState(0)
  useResize(() => setRevision((value) => value + 1))
  // resize 会触发渲染，重新读取安全区与 rpx 比例。
  return useMemo(() => {
    void revision
    return readInsets(surface)
  }, [surface, revision])
}
