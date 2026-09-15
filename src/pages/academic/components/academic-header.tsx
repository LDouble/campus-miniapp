import type { ReactNode } from 'react'
import { View } from '@tarojs/components'
import CustomNavbar, { getNavbarMetrics } from '../../../components/custom-navbar'
import { getSystemState } from '../../../state/system'

interface AcademicHeaderProps {
  title: string
  toolbar: ReactNode
  variant?: 'default' | 'schedule'
}

export default function AcademicHeader({ title, toolbar, variant = 'default' }: AcademicHeaderProps) {
  const metrics = getNavbarMetrics()
  const navbarHeight = metrics.statusBarHeight + metrics.navigationBarHeight
  const panelHeight = 110 * getSystemState().windowInfo.windowWidth / 750

  if (variant === 'schedule') {
    return (
      <CustomNavbar
        title=''
        showBack
        barContent={toolbar}
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
        {toolbar}
      </View>
      <View className='academic-header-spacer' style={{ height: `${panelHeight}px` }} />
    </>
  )
}
