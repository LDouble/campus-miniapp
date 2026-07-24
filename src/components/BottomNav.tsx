import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { DesignIcon } from './DesignIcon'

export function BottomNav ({ active = 'home', onPublish }: { active?: string; onPublish: () => void }) {
  const go = (name: string) => {
    if (name === 'home') Taro.switchTab({ url: '/pages/index/index' })
    if (name === 'community') Taro.navigateTo({ url: '/pages/community/index' })
    if (name === 'mine') Taro.switchTab({ url: '/pages/mine/index' })
  }
  return <View className='bottom-nav'>
    <View className={`nav-item ${active === 'home' ? 'active' : ''}`} onClick={() => go('home')}><DesignIcon name='home' /><Text>首页</Text></View>
    <View className={`nav-item ${active === 'community' ? 'active' : ''}`} onClick={() => go('community')}><DesignIcon name='community' /><Text>社区</Text></View>
    <View className='nav-publish' onClick={onPublish}><DesignIcon name='plus' /></View>
    <View className='nav-item' onClick={() => Taro.showToast({ title: '消息功能即将开放', icon: 'none' })}><DesignIcon name='message' /><Text>消息</Text><View className='unread-dot' /></View>
    <View className={`nav-item ${active === 'mine' ? 'active' : ''}`} onClick={() => go('mine')}><DesignIcon name='user' /><Text>我的</Text></View>
  </View>
}
