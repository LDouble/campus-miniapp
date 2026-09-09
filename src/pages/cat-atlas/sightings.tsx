import { Image, Text, View } from '@tarojs/components'
import { useDidShow, useRouter } from '@tarojs/taro'
import { useCallback, useState } from 'react'
import CustomNavbar from '../../components/custom-navbar'
import { getCat, listCatSightings, setSightingLiked, type CatView, type SightingView } from '../../api/cat-atlas'
import { RequestState } from '../../features/cat-atlas/ui'
import './shared.scss'
import './detail-feed.scss'

const locationIcon = require('../../assets/icons/location.svg')
const heartIcon = require('../../assets/community/heart.svg')
const fallbackPhotos = [
  require('../../assets/cat-atlas/stitch/sighting-library.jpg'),
  require('../../assets/cat-atlas/stitch/sighting-canteen.jpg'),
  require('../../assets/cat-atlas/stitch/sighting-dorm.jpg'),
]
const fallbackAvatars = [
  require('../../assets/cat-atlas/stitch/avatar-chen.jpg'),
  require('../../assets/cat-atlas/stitch/avatar-seasalt.jpg'),
]

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
    <CustomNavbar title={cat ? `${cat.name} · 最近动态` : '最近动态'} showBack />
    <View className='cat-sightings-page__content'>
      <RequestState loading={loading} error={error} empty={!loading && !error && !items.length ? '还没有目击记录' : undefined} onRetry={() => void load()} />
      {items.map((item, index) => {
        const isLiked = item.liked
        const photo = item.photo_url || fallbackPhotos[index % fallbackPhotos.length]
        const avatar = index < fallbackAvatars.length ? fallbackAvatars[index] : undefined
        return <View key={item.id} className='cat-stitch-feed-card'>
          <View className='cat-stitch-feed-card__head'>
            <View className={`cat-stitch-feed-card__avatar ${item.reporter_avatar_url || avatar ? '' : 'cat-stitch-feed-card__avatar--anonymous'}`}>
              {item.reporter_avatar_url || avatar ? <Image src={item.reporter_avatar_url || avatar} mode='aspectFill' /> : <Text>{item.reporter_name.slice(0, 1) || '匿'}</Text>}
            </View>
            <View className='cat-stitch-feed-card__identity'><Text>{item.reporter_name || '匿名用户'}</Text><View><Image src={locationIcon} mode='aspectFit' /><Text>{item.area}</Text></View></View>
            <Text className='cat-stitch-feed-card__time'>{formatTimelineTime(item.created_at)}</Text>
          </View>
          <Text className='cat-stitch-feed-card__note'>{item.note || `它正在${item.activity}`}</Text>
          <Image className='cat-stitch-feed-card__photo' src={photo} mode='aspectFill' />
          <View className={`cat-stitch-feed-card__like ${isLiked ? 'is-liked' : ''}`} onClick={async () => { const previous = item; setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, liked: !isLiked, like_count: Math.max(0, entry.like_count + (isLiked ? -1 : 1)) } : entry)); try { const state = await setSightingLiked(item.id, !isLiked); setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, liked: state.liked, like_count: state.like_count } : entry)) } catch { setItems((current) => current.map((entry) => entry.id === item.id ? previous : entry)) } }}><Image src={heartIcon} mode='aspectFit' /><Text>{item.like_count}</Text></View>
        </View>
      })}
    </View>
  </View>
}
