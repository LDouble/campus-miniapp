import { View, Text, Input, ScrollView } from '@tarojs/components'
import Taro, { useLoad, usePullDownRefresh } from '@tarojs/taro'
import { useState } from 'react'
import { getFeed, FeedItem } from '../../services/api'
import { FeedCard } from '../../components/FeedCard'
import { DesignIcon } from '../../components/DesignIcon'
import { useStatusBarHeight } from '../../hooks/useStatusBar'
import './index.scss'

const topics = ['全部', '闲置', '跑腿', '拼车', '失物招领', '吐槽', '求助', '找搭子']
const typeMap: Record<string, string> = { 闲置: 'marketplace', 跑腿: 'errand', 拼车: 'carpool', 失物招领: 'campus-circle' }

export default function Community () {
  const [topic, setTopic] = useState('全部')
  const [items, setItems] = useState<FeedItem[]>([])
  const [keyword, setKeyword] = useState('')
  const statusBarHeight = useStatusBarHeight()
  const load = async () => { try { setItems(await getFeed()) } catch (_) { setItems([]) } finally { Taro.stopPullDownRefresh() } }
  useLoad(params => { if (params.topic) setTopic(params.topic); void load() })
  usePullDownRefresh(() => { void load() })
  const filtered = items.filter(item => (topic === '全部' || item.type === typeMap[topic] || (topic === '失物招领' && item.type === 'campus-circle')) && `${item.title}${item.summary}`.includes(keyword))
  return <View className='community-page'>
    <View className='community-header' style={{ paddingTop: `${statusBarHeight + 12}px` }}><View className='community-title-row'><Text>社区</Text><View className='search-box'><DesignIcon name='search' /><Input value={keyword} onInput={event => setKeyword(event.detail.value)} placeholder={topic === '闲置' ? '搜索二手商品...' : '搜索同学、圈子或话题...'} /></View></View><ScrollView scrollX className='topic-scroll'>{topics.map(name => <Text key={name} className={`topic-tab ${topic === name ? 'selected' : ''}`} onClick={() => setTopic(name)}>{name}</Text>)}</ScrollView>{['闲置', '跑腿', '拼车'].includes(topic) && <ScrollView scrollX className='filter-scroll'><Text>全部分类⌄</Text><Text>默认排序⌄</Text><Text>快捷筛选⌄</Text></ScrollView>}</View>
    <ScrollView scrollY className='community-feed'>{filtered.length ? filtered.map(item => <FeedCard item={item} key={`${item.type}-${item.id}`} />) : <View className='community-empty'><Text>还没有相关内容</Text><Text>换个话题看看吧</Text></View>}</ScrollView>
  </View>
}
