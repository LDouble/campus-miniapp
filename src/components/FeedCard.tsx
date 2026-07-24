import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { DesignIcon } from './DesignIcon'
import { DesignCard } from './DesignCard'
import type { FeedItem } from '../services/api'

export function FeedCard ({ item }: { item: FeedItem }) {
  return <DesignCard className='feed-card' onClick={() => Taro.navigateTo({ url: `/pages/detail/index?type=${item.type}&id=${item.id}` })}>
    <View className='feed-head'><View className='avatar'>{item.title.slice(0, 1)}</View><View className='feed-author'><Text className='author-name'>校园同学</Text><Text className='feed-time'>{item.updated_at ? item.updated_at.slice(0, 16).replace('T', ' ') : '刚刚'}</Text></View><Text className={`topic topic-${item.type}`}>{item.type === 'campus-circle' ? '动态' : item.type}</Text></View>
    <Text className='feed-title'>{item.title}</Text><Text className='feed-summary'>{item.summary || '暂无简介'}</Text>
    <View className='feed-foot'><Text><DesignIcon name='heart' /> 赞</Text><Text><DesignIcon name='comment' /> 评论</Text><Text><DesignIcon name='share' /> 分享</Text><Text className='feed-status'>{item.review_status || item.status || '公开'}</Text></View>
  </DesignCard>
}
