import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useNavigationMetrics } from '../hooks/useNavigationMetrics'
import './AcademicHeader.scss'

interface AcademicHeaderProps {
  title: string
  meta: string
  tone: 'sage' | 'paper'
}

export function AcademicHeader ({ title, meta, tone }: AcademicHeaderProps) {
  const { statusBarHeight, navBarHeight, topInset, rightInset } = useNavigationMetrics()

  const goBack = () => {
    if (Taro.getCurrentPages().length > 1) {
      void Taro.navigateBack()
      return
    }
    void Taro.switchTab({ url: '/pages/index/index' })
  }

  return <View className={`academic-custom-header academic-custom-header-${tone}`} style={{ height: `${topInset}px`, paddingTop: `${statusBarHeight}px` }}>
    <View className='academic-custom-navbar' style={{ height: `${navBarHeight}px`, paddingRight: `${rightInset}px` }}>
      <View className='academic-custom-back' hoverClass='academic-custom-back-pressed' onClick={goBack}>
        <View className='academic-back-chevron' />
      </View>
      <View className='academic-custom-title'>
        <Text>{title}</Text>
        <View className='academic-title-rule' />
      </View>
      <Text className='academic-custom-meta'>{meta}</Text>
    </View>
  </View>
}
