import type { ReactNode } from 'react'
import Taro from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import './index.scss'

interface CustomNavbarProps {
  title: string
  subtitle?: string
  showBack?: boolean
  theme?: 'light' | 'ocean'
  immersive?: boolean
  compactImmersive?: boolean
  collapsed?: boolean
  actionIcon?: string
  actionLabel?: string
  actionVisible?: boolean
  onAction?: () => void
  bottomContent?: ReactNode
  bottomContentHeight?: number
  bottomContentClassName?: string
  barContent?: ReactNode
  barContentClassName?: string
}

export const getNavbarMetrics = () => {
  const fallback = {
    statusBarHeight: 20,
    navigationBarHeight: 44,
    sideWidth: 88,
  }

  try {
    const windowInfo = Taro.getWindowInfo()
    const menuRect = Taro.getMenuButtonBoundingClientRect()
    const statusBarHeight = windowInfo.statusBarHeight || fallback.statusBarHeight
    const hasValidMenuRect = (
      menuRect.width > 0
      && menuRect.height > 0
      && menuRect.top >= statusBarHeight
      && menuRect.left > 0
    )

    if (!hasValidMenuRect) {
      return { ...fallback, statusBarHeight }
    }

    const menuGap = Math.max(menuRect.top - statusBarHeight, 4)
    const navigationBarHeight = Math.max(menuRect.height + menuGap * 2, 40)
    const sideWidth = Math.max(windowInfo.windowWidth - menuRect.left, 72)

    return { statusBarHeight, navigationBarHeight, sideWidth }
  } catch (error) {
    return fallback
  }
}

function CustomNavbar({
  title,
  subtitle,
  showBack = false,
  theme = 'light',
  immersive = false,
  compactImmersive = false,
  collapsed = true,
  actionIcon,
  actionLabel = '导航操作',
  actionVisible = true,
  onAction,
  bottomContent,
  bottomContentHeight = 0,
  bottomContentClassName = '',
  barContent,
  barContentClassName = '',
}: CustomNavbarProps) {
  const metrics = getNavbarMetrics()
  const navbarHeight = metrics.statusBarHeight + metrics.navigationBarHeight
  const goBack = () => {
    const pages = Taro.getCurrentPages()
    if (pages.length > 1) {
      Taro.navigateBack()
      return
    }
    Taro.reLaunch({ url: '/pages/index/index' })
  }

  return (
    <View
      className={[
        'custom-navbar',
        `custom-navbar--${theme}`,
        immersive ? 'custom-navbar--immersive' : '',
        compactImmersive ? 'custom-navbar--compact-immersive' : '',
        compactImmersive && !showBack ? 'custom-navbar--pass-through' : '',
        collapsed ? 'custom-navbar--collapsed' : '',
        bottomContent ? 'custom-navbar--has-bottom' : '',
      ].filter(Boolean).join(' ')}
      style={{ height: `${compactImmersive ? metrics.statusBarHeight : navbarHeight + bottomContentHeight}px` }}
    >
      <View
        className='custom-navbar__fixed'
        style={{ paddingTop: `${metrics.statusBarHeight}px` }}
      >
        <View
          className='custom-navbar__bar'
          style={{ height: `${metrics.navigationBarHeight}px` }}
        >
          <View
            className='custom-navbar__side custom-navbar__side--left'
            style={{ width: `${metrics.sideWidth}px` }}
          >
            {showBack && (
              <View
                className='custom-navbar__back'
                hoverClass='custom-navbar__back--pressed'
                onClick={goBack}
              >
                <View className='custom-navbar__back-icon' />
              </View>
            )}
          </View>

          {!barContent && (
            <View className='custom-navbar__center'>
              <Text className='custom-navbar__title'>{title}</Text>
              {subtitle && <Text className='custom-navbar__subtitle'>{subtitle}</Text>}
            </View>
          )}

          <View
            className='custom-navbar__side'
            style={{ width: `${metrics.sideWidth}px` }}
          />

          {barContent && (
            <View
              className={`custom-navbar__bar-content ${barContentClassName}`}
              style={{ left: `${metrics.sideWidth}px`, right: `${metrics.sideWidth}px` }}
            >
              {barContent}
            </View>
          )}

          {actionIcon && actionVisible && (
            <View
              className='custom-navbar__action'
              style={{ right: `${metrics.sideWidth + 6}px` }}
              hoverClass='custom-navbar__action--pressed'
              ariaRole='button'
              ariaLabel={actionLabel}
              onClick={onAction}
            >
              <Image src={actionIcon} mode='aspectFit' />
            </View>
          )}
        </View>
        {bottomContent && (
          <View
            className={`custom-navbar__bottom ${bottomContentClassName}`}
            style={{ height: `${bottomContentHeight}px` }}
          >
            {bottomContent}
          </View>
        )}
      </View>
    </View>
  )
}

export default CustomNavbar
