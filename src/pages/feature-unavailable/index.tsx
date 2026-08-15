import { Text, View } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import CustomNavbar from '../../components/custom-navbar'
import './index.scss'

export default function FeatureUnavailablePage() {
  const [message, setMessage] = useState('功能维护中，请稍后再试')

  useLoad((options) => {
    if (options.message) setMessage(decodeURIComponent(options.message))
  })

  const goHome = () => {
    void Taro.reLaunch({ url: '/pages/index/index' })
  }

  return (
    <View className='feature-unavailable'>
      <CustomNavbar title='功能维护' showBack />
      <View className='feature-unavailable__content'>
        <View className='feature-unavailable__card'>
          <View className='feature-unavailable__mark'>
            <View />
            <View />
            <View />
          </View>
          <Text className='feature-unavailable__title'>正在认真准备</Text>
          <Text className='feature-unavailable__message'>{message}</Text>
          <View
            className='feature-unavailable__action'
            hoverClass='feature-unavailable__action--pressed'
            ariaRole='button'
            ariaLabel='返回首页'
            onClick={goHome}
          >
            返回首页
          </View>
        </View>
      </View>
    </View>
  )
}
