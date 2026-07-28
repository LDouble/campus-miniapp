import Taro from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import CustomNavbar from '../custom-navbar'
import './index.scss'

const icons = {
  community: require('../../assets/icons/community.svg'),
  publish: require('../../assets/icons/plus.svg'),
  messages: require('../../assets/icons/message.svg'),
  profile: require('../../assets/icons/profile.svg'),
  arrow: require('../../assets/icons/arrow.svg'),
}

export type TabPageType = 'community' | 'publish' | 'messages' | 'profile'

const content = {
  community: {
    title: '海大社区',
    subtitle: '在海大，遇见同频的朋友',
    icon: icons.community,
    stats: ['校园热榜', '找搭子', '校园随拍'],
    cards: ['崂山校区今天的晚霞也太美了', '鱼山校区樱花季拍照机位分享', '今晚东操场夜跑，有人一起吗？'],
    action: '发布校园动态',
  },
  publish: {
    title: '发布中心',
    subtitle: '让每一份需求都被看见',
    icon: icons.publish,
    stats: ['发动态', '卖闲置', '找失物'],
    cards: ['发布跑腿需求', '出售闲置物品', '登记失物信息'],
    action: '选择发布类型',
  },
  messages: {
    title: '消息',
    subtitle: '校园消息，及时抵达',
    icon: icons.messages,
    stats: ['系统通知', '互动消息', '交易消息'],
    cards: ['教务提醒：明日有 3 节课程', '校园社区：你的动态收到新评论', '二手交易：同学咨询了你的闲置'],
    action: '全部标为已读',
  },
  profile: {
    title: '我的海大',
    subtitle: '中国海洋大学 · 2024级',
    icon: icons.profile,
    stats: ['我的课表', '我的发布', '服务记录'],
    cards: ['校园身份与认证', '收藏与浏览历史', '设置与意见反馈'],
    action: '完善个人资料',
  },
} as const

function TabPage({
  type,
  showBack = false,
  headerCollapsed = false,
}: {
  type: TabPageType
  showBack?: boolean
  headerCollapsed?: boolean
}) {
  const data = content[type]
  const showTip = (text: string) => Taro.showToast({ title: text, icon: 'none' })

  return (
    <View className={`tab-page tab-page--${type}`}>
      <CustomNavbar
        title={data.title}
        showBack={showBack}
        immersive
        collapsed={headerCollapsed}
      />
      <View className='tab-page__body'>
        <View className='tab-page__hero'>
          <View className='tab-page__hero-icon'>
            <Image src={data.icon} mode='aspectFit' />
          </View>
          <View>
            <Text className='tab-page__hero-title'>{data.subtitle}</Text>
            <Text className='tab-page__hero-subtitle'>海大校园服务</Text>
          </View>
          <View className='tab-page__wave tab-page__wave--one' />
          <View className='tab-page__wave tab-page__wave--two' />
        </View>

        <View className='tab-page__quick'>
          {data.stats.map((item) => (
            <View key={item} onClick={() => showTip(item)}>
              <Text>{item}</Text>
            </View>
          ))}
        </View>

        <View className='tab-page__heading'>
          <Text>为你推荐</Text>
          <Text>海大校园服务</Text>
        </View>

        <View className='tab-page__cards'>
          {data.cards.map((item, index) => (
            <View key={item} className='tab-page__card' onClick={() => showTip(item)}>
              <View className='tab-page__card-index'>{String(index + 1).padStart(2, '0')}</View>
              <Text>{item}</Text>
              <Image src={icons.arrow} mode='aspectFit' />
            </View>
          ))}
        </View>

        <View className='tab-page__action' onClick={() => showTip(data.action)}>
          {data.action}
        </View>
      </View>
    </View>
  )
}

export default TabPage
