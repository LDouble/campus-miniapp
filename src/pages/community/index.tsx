import { View, Text, Input, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, useLoad } from '@tarojs/taro'
import { useState } from 'react'
import { getFeed, FeedItem } from '../../services/api'
import { FeedCard } from '../../components/FeedCard'
import { DesignIcon } from '../../components/DesignIcon'
import { BottomSheetPicker } from '../../components/BottomSheetPicker'
import { useNavigationMetrics } from '../../hooks/useNavigationMetrics'
import { consumeCommunityTopic, syncCustomTabBar } from '../../utils/tabbar'
import './index.scss'

const topics = ['全部', '闲置', '跑腿', '拼车', '失物招领', '吐槽', '求助', '找搭子']
const typeMap: Record<string, string> = { 闲置: 'marketplace', 跑腿: 'errand', 拼车: 'carpool', 失物招领: 'campus-circle' }
interface FilterDefinition { key: string; label: string; title: string; options: string[] }
const topicFilters: Record<string, FilterDefinition[]> = {
  闲置: [
    { key: 'idle-category', label: '全部分类', title: '选择分类', options: ['全部分类', '数码电子', '书籍资料', '服饰鞋包', '美妆个护', '生活用品'] },
    { key: 'idle-price', label: '价格排序', title: '排序方式', options: ['默认综合排序', '价格从低到高', '价格从高到低'] },
    { key: 'idle-condition', label: '成色', title: '选择成色', options: ['全部成色', '全新/仅拆封', '九成新', '有使用痕迹'] }
  ],
  跑腿: [
    { key: 'errand-type', label: '全部类型', title: '选择分类', options: ['全部类型', '代取快递', '代买餐饮', '打印复印', '其他帮办事'] },
    { key: 'errand-sort', label: '默认排序', title: '排序方式', options: ['默认排序', '赏金最高', '最新发布', '距离最近'] },
    { key: 'errand-urgent', label: '全部订单', title: '快捷筛选', options: ['全部订单', '急单优先'] }
  ],
  拼车: [
    { key: 'carpool-dest', label: '全部目的地', title: '选择目的地', options: ['全部目的地', '高铁南站', '国际机场', '市中心商圈', '跨校区'] },
    { key: 'carpool-time', label: '全部时间', title: '出发时间', options: ['全部时间', '今天', '明天', '本周末'] },
    { key: 'carpool-seat', label: '全部拼车', title: '快捷筛选', options: ['全部拼车', '只看有座', '我找车', '车找人'] }
  ]
}

export default function Community () {
  const [topic, setTopic] = useState('全部')
  const [items, setItems] = useState<FeedItem[]>([])
  const [keyword, setKeyword] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [activeFilter, setActiveFilter] = useState<FilterDefinition | null>(null)
  const [filterValues, setFilterValues] = useState<Record<string, string>>({})
  const { topInset } = useNavigationMetrics()
  const load = async () => { try { setItems(await getFeed()) } catch (_) { setItems([]) } finally { setRefreshing(false) } }
  useLoad(params => { if (params.topic) setTopic(params.topic); void load() })
  useDidShow(() => {
    syncCustomTabBar(1)
    const pendingTopic = consumeCommunityTopic()
    if (pendingTopic) setTopic(pendingTopic)
  })
  const filters = topicFilters[topic] || []
  const filtered = items.filter(item => (topic === '全部' || item.type === typeMap[topic] || (topic === '失物招领' && item.type === 'campus-circle')) && `${item.title}${item.summary}`.includes(keyword))
  return <View className='community-page'>
    <View className='community-header' style={{ paddingTop: `${topInset + 8}px` }}><View className='community-title-row'><Text>社区</Text><View className='search-box'><DesignIcon name='search' /><Input value={keyword} onInput={event => setKeyword(event.detail.value)} placeholder={topic === '闲置' ? '搜索二手商品...' : '搜索同学、圈子或话题...'} /></View></View><ScrollView scrollX className='topic-scroll'>{topics.map(name => <Text key={name} className={`topic-tab ${topic === name ? 'selected' : ''}`} onClick={() => { setTopic(name); setActiveFilter(null) }}>{name}</Text>)}</ScrollView>{filters.length > 0 && <ScrollView scrollX className='filter-scroll'>{filters.map(filter => <Text key={filter.key} className={filterValues[filter.key] ? 'selected' : ''} onClick={() => setActiveFilter(filter)}>{filterValues[filter.key] || filter.label}⌄</Text>)}</ScrollView>}</View>
    <ScrollView scrollY refresherEnabled refresherTriggered={refreshing} onRefresherRefresh={() => { setRefreshing(true); void load() }} className='community-feed'>{filtered.length ? filtered.map(item => <FeedCard item={item} key={`${item.type}-${item.id}`} />) : <View className='community-empty'><Text>还没有相关内容</Text><Text>换个话题看看吧</Text></View>}</ScrollView>
    <BottomSheetPicker
      open={Boolean(activeFilter)}
      title={activeFilter?.title || ''}
      options={activeFilter?.options || []}
      value={activeFilter ? (filterValues[activeFilter.key] || activeFilter.options[0]) : ''}
      onClose={() => setActiveFilter(null)}
      onSelect={value => {
        if (!activeFilter) return
        setFilterValues(previous => ({ ...previous, [activeFilter.key]: value }))
        setActiveFilter(null)
      }}
    />
  </View>
}
