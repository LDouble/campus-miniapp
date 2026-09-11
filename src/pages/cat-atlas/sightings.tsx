import { Image, Text, View } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh, useReachBottom, useRouter } from '@tarojs/taro'
import { useCallback, useRef, useState } from 'react'
import CustomNavbar, { getNavbarMetrics } from '../../components/custom-navbar'
import { getCat, listCatSightings, setSightingLiked, type CatView, type SightingView } from '../../api/cat-atlas'
import { RequestState } from '../../features/cat-atlas/ui'
import { catPhotoHeightPercent } from '../../features/cat-atlas/photo-layout'
import { navigateToWithGuard } from '../../utils/navigation'
import './atlas.scss'
import './sightings-journal.scss'

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

function SightingPhoto({ source }: { source: string }) {
  const [photoBroken, setPhotoBroken] = useState(false)
  const [heightPercent, setHeightPercent] = useState(75)
  if (photoBroken) return null
  return <View className='journal-photo' style={{ paddingTop: `${heightPercent}%` }} onClick={() => void Taro.previewImage({ current: source, urls: [source] })}>
    <Image className='cat-stitch-feed-card__photo' src={source} mode='aspectFill' onLoad={(event) => setHeightPercent(catPhotoHeightPercent(Number(event.detail.width), Number(event.detail.height)))} onError={() => setPhotoBroken(true)} />
  </View>
}

function ReporterAvatar({ name, source }: { name: string; source?: string | null }) {
  const [broken, setBroken] = useState(false)
  return <View className='journal-card__avatar'>
    {source && !broken ? <Image src={source} mode='aspectFill' onError={() => setBroken(true)} /> : <Text>{name?.slice(0, 1) || '匿'}</Text>}
  </View>
}

export default function CatSightingsPage() {
  const { params } = useRouter()
  const [cat, setCat] = useState<CatView | null>(null)
  const [items, setItems] = useState<SightingView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [pendingLikes, setPendingLikes] = useState<Set<number>>(new Set())
  const busy = useRef(false)
  const page = useRef(1)
  const likeLocks = useRef(new Set<number>())
  const navbarMetrics = getNavbarMetrics()
  const navbarHeight = navbarMetrics.statusBarHeight + navbarMetrics.navigationBarHeight
  const load = useCallback(async () => {
    if (busy.current) { void Taro.stopPullDownRefresh(); return }
    if (!params.id) {
      setLoading(false)
      setError('请选择一只猫后查看动态')
      void Taro.stopPullDownRefresh()
      return
    }
    busy.current = true
    setLoading(true)
    setError('')
    try {
      const [profile, feed] = await Promise.all([getCat(params.id), listCatSightings(params.id)])
      setCat(profile)
      setItems(feed.items)
      page.current = 1
      setTotal(feed.total)
      setHasMore(feed.items.length > 0 && feed.page * feed.page_size < feed.total)
      setMoreError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '动态加载失败')
    } finally {
      setLoading(false)
      busy.current = false
      void Taro.stopPullDownRefresh()
    }
  }, [params.id])
  useDidShow(() => { void load() })
  usePullDownRefresh(() => { void load() })

  const loadMore = async () => {
    if (busy.current || loading || error || !hasMore || !params.id) return
    busy.current = true
    setLoadingMore(true)
    setMoreError('')
    try {
      const feed = await listCatSightings(params.id, page.current + 1)
      setItems((current) => {
        const ids = new Set(current.map((item) => item.id))
        return [...current, ...feed.items.filter((item) => !ids.has(item.id))]
      })
      page.current = feed.page
      setTotal(feed.total)
      setHasMore(feed.items.length > 0 && feed.page * feed.page_size < feed.total)
    } catch {
      setMoreError('加载失败，点击重试')
    } finally {
      busy.current = false
      setLoadingMore(false)
    }
  }
  useReachBottom(() => { void loadMore() })

  const toggleLike = async (item: SightingView) => {
    if (likeLocks.current.has(item.id)) return
    likeLocks.current.add(item.id)
    setPendingLikes(new Set(likeLocks.current))
    try {
      const state = await setSightingLiked(item.id, !item.liked)
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, liked: state.liked, like_count: state.like_count } : entry))
    } catch {
      void Taro.showToast({ title: '操作失败，请重试', icon: 'none' })
    } finally {
      likeLocks.current.delete(item.id)
      setPendingLikes(new Set(likeLocks.current))
    }
  }

  return <View className='cat-sightings-page cat-journal-page'>
    <CustomNavbar title='最近动态' showBack fixed />
    <View className='cat-sightings-page__content' style={{ paddingTop: `${navbarHeight + 14}px` }}>
      <RequestState loading={loading} error={error} onRetry={() => void load()} />
      {cat && !loading && !error && <>
        <View className='journal-summary'>
          <View className='journal-summary__copy'><Text className='journal-summary__name'>{cat.name}</Text><Text className='journal-summary__count'>{total} 条相遇记录 · 校园日常</Text></View>
          <View className='journal-summary__record' ariaRole='button' ariaLabel='记录新的相遇' onClick={() => void navigateToWithGuard(`/pages/cat-atlas/report?id=${cat.id}&name=${encodeURIComponent(cat.name)}`)}><Text>＋ 记一笔</Text></View>
        </View>
      </>}
      <RequestState empty={!loading && !error && !items.length ? '还没有目击记录，来留下第一条吧' : undefined} />
      {!loading && !error && items.map((item) => {
        const isLiked = item.liked
        return <View key={item.id} className='journal-card'>
          <View className='journal-card__head'>
            <ReporterAvatar key={`${item.id}-${item.reporter_avatar_url}`} name={item.reporter_name} source={item.reporter_avatar_url} />
            <View className='journal-card__identity'><Text>{item.reporter_name || '匿名用户'}</Text><Text>{formatTimelineTime(item.created_at)}</Text></View>
            {item.activity && <View className='journal-card__activity'><Text>它在{item.activity}</Text></View>}
          </View>
          {item.photo_url && <SightingPhoto source={item.photo_url} />}
          {item.note && <Text className='journal-card__note'>{item.note}</Text>}
          <View className='journal-card__footer'><View className='journal-card__location'><Image src={locationIcon} mode='aspectFit' /><Text>{item.area}</Text></View>
            <View className={`journal-card__like ${isLiked ? 'is-liked' : ''}`} ariaRole='button' ariaLabel={isLiked ? '取消点赞' : '点赞'} onClick={() => void toggleLike(item)}><Image src={heartIcon} mode='aspectFit' /><Text>{pendingLikes.has(item.id) ? '…' : item.like_count || '赞'}</Text></View>
          </View>
        </View>
      })}
      {!loading && !error && items.length > 0 && <View className='journal-pagination' onClick={() => void loadMore()}>{loadingMore ? '正在加载…' : moreError || (hasMore ? '上拉或点击，查看更多相遇' : '每一次相遇，都在这里了')}</View>}
    </View>
  </View>
}
