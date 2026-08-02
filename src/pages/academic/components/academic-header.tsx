import type { ReactNode } from 'react'
import Taro from '@tarojs/taro'
import { View } from '@tarojs/components'
import CustomNavbar, { getNavbarMetrics } from '../../../components/custom-navbar'
import AcademicChannelSwitch from './academic-channel-switch'

interface AcademicHeaderProps {
  title: string
  toolbar: ReactNode
  variant?: 'default' | 'schedule'
}

export default function AcademicHeader({ title, toolbar, variant = 'default' }: AcademicHeaderProps) {
  const metrics = getNavbarMetrics()
  const navbarHeight = metrics.statusBarHeight + metrics.navigationBarHeight
  const panelHeight = 110 * (Taro.getWindowInfo().windowWidth || 375) / 750
  const channelToolbar = (
    <View className={`academic-channel-toolbar academic-channel-toolbar--${variant}`}>
      {toolbar}
      <AcademicChannelSwitch compact={variant === 'schedule'} />
    </View>
  )

  if (variant === 'schedule') {
    return (
      <CustomNavbar
        title=''
        showBack
        barContent={channelToolbar}
        barContentClassName='custom-navbar__bar-content--academic'
      />
    )
  }

  return (
    <>
      <CustomNavbar title={title} subtitle='中国海洋大学' showBack />
      <View
        className={`academic-header academic-header--${variant}`}
        style={{ top: `${navbarHeight}px` }}
      >
        {channelToolbar}
      </View>
      <View className='academic-header-spacer' style={{ height: `${panelHeight}px` }} />
    </>
  )
}
