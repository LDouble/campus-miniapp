import { Image, Text, View } from '@tarojs/components'
import { useDidShow, useRouter } from '@tarojs/taro'
import { useCallback, useState } from 'react'
import CustomNavbar, { getNavbarMetrics } from '../../components/custom-navbar'
import { getCat, listCatSightings, setSightingLiked, type CatView, type SightingView } from '../../api/cat-atlas'
import { RequestState } from '../../features/cat-atlas/ui'
import { navigateToWithGuard } from '../../utils/navigation'
import './shared.scss'
import './detail-feed.scss'
import './warm-theme.scss'

const locationIcon = require('../../assets/icons/location-warm.svg')
const heartIcon = require('../../assets/community/heart.svg')

const formatTimelineTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const clock = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  return isToday ? clock : date.toDateString() === yesterday.toDateString() ? `昨天 ${clock}` : `${date.getMonth() + 1}/${date.getDate()} ${clock}`
}

export default function CatSightingsPage() {
  const { params } = useRouter()
  const [cat, setCat] = useState<CatView | null>(null)
  const [items, setItems] = useState<SightingView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navbarMetrics = getNavbarMetrics()
  const navbarHeight = navbarMetrics.statusBarHeight + navbarMetrics.navigationBarHeight
  const load = useCallback(async () => {
    if (!params.id) {
      setLoading(false)
      setError('请选择一只猫后查看动态')
      return
    }
    setLoading(true)
    setError('')
    try {
      const [profile, feed] = await Promise.all([getCat(params.id), listCatSightings(params.id)])
      setCat(profile)
      setItems(feed.items)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '动态加载失败')
    } finally {
      setLoading(false)
    }
  }, [params.id])
  useDidShow(() => { void load() })

  return <View className='cat-page cat-sightings-page'>
    <CustomNavbar title={cat ? `${cat.name} · 最近动态` : '最近动态'} showBack fixed />
    <View className='cat-sightings-page__content' style={{ paddingTop: `${navbarHeight + 14}px` }}>
      <RequestState loading={loading} error={error} empty={!loading && !error && !items.length ? '还没有目击记录' : undefined} onRetry={() => void load()} />
      {cat && <View className='cat-sightings-page__contribute' onClick={() => void navigateToWithGuard(`/pages/cat-atlas/report?id=${cat.id}&name=${encodeURIComponent(cat.name)}`)}>
        <View><Text>你也见到 {cat.name} 了吗？</Text><Text>补充它此刻的状态、地点或照片</Text></View>
        <Text>去记录</Text>
      </View>}
      {items.map((item) => {
        const isLiked = item.liked
        return <View key={item.id} className='cat-stitch-feed-card'>
          <View className='cat-stitch-feed-card__head'>
            <View className={`cat-stitch-feed-card__avatar ${item.reporter_avatar_url ? '' : 'cat-stitch-feed-card__avatar--anonymous'}`}>
              {item.reporter_avatar_url ? <Image src={item.reporter_avatar_url} mode='aspectFill' /> : <Text>{item.reporter_name.slice(0, 1) || '匿'}</Text>}
            </View>
            <View className='cat-stitch-feed-card__identity'><Text>{item.reporter_name || '匿名用户'}</Text><View><Image src={locationIcon} mode='aspectFit' /><Text>{item.area}</Text></View></View>
            <Text className='cat-stitch-feed-card__time'>{formatTimelineTime(item.created_at)}</Text>
          </View>
          <View className='cat-stitch-feed-card__activity'><Text>它在{item.activity || '悠闲活动'}</Text></View>
          <Text className='cat-stitch-feed-card__note'>{item.note || '记录了这次相遇'}</Text>
          {item.photo_url && <Image className='cat-stitch-feed-card__photo' src={item.photo_url} mode='aspectFill' />}
          <View className={`cat-stitch-feed-card__like ${isLiked ? 'is-liked' : ''}`} onClick={async () => { const previous = item; setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, liked: !isLiked, like_count: Math.max(0, entry.like_count + (isLiked ? -1 : 1)) } : entry)); try { const state = await setSightingLiked(item.id, !isLiked); setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, liked: state.liked, like_count: state.like_count } : entry)) } catch { setItems((current) => current.map((entry) => entry.id === item.id ? previous : entry)) } }}><Image src={heartIcon} mode='aspectFit' /><Text>{item.like_count}</Text></View>
        </View>
      })}
    </View>
  </View>
}
