import { Image, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { useCallback, useState } from 'react'
import CustomNavbar, { getNavbarMetrics } from '../../components/custom-navbar'
import { getCat, listCatSightings, setCatFavorite, type CatView, type SightingView } from '../../api/cat-atlas'
import { formatCatDate, RequestState } from '../../features/cat-atlas/ui'
import { navigateToWithGuard } from '../../utils/navigation'
import './shared.scss'
import './detail-feed.scss'
import './warm-theme.scss'

const eyeIcon = require('../../assets/icons/eye.svg')
const plusIcon = require('../../assets/icons/plus.svg')
const heartIcon = require('../../assets/community/heart.svg')
const heroFallbacks = [
  require('../../assets/cat-atlas/stitch/detail-hero-1.jpg'),
  require('../../assets/cat-atlas/stitch/detail-hero-2.jpg'),
  require('../../assets/cat-atlas/stitch/detail-hero-3.jpg'),
]

export default function CatDetailPage() {
  const { params } = useRouter()
  const id = params.id || ''
  const navbarMetrics = getNavbarMetrics()
  const [cat, setCat] = useState<CatView | null>(null)
  const [sightings, setSightings] = useState<SightingView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [isFavorite, setFavorite] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [profile, feed] = await Promise.all([getCat(id), listCatSightings(id)])
      setCat(profile)
      setFavorite(profile.favorited)
      setSightings(feed.items.slice(0, 2))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '暂时无法获取猫咪档案')
    } finally {
      setLoading(false)
    }
  }, [id])

  useDidShow(() => { void load() })

  if (loading || error || !cat) {
    return <View className='cat-page'><CustomNavbar title='猫咪详情' showBack /><View className='cat-page__content'><RequestState loading={loading} error={error} onRetry={() => void load()} /></View></View>
  }

  const fields = [
    ['别名', cat.aliases.join(' / ') || '暂无'],
    ['性别', cat.gender],
    ['毛色', cat.coat],
    ['性格', cat.traits.join('、')],
    ['常驻区域', cat.resident_area],
    ['首次记录', formatCatDate(cat.first_recorded_at)],
  ]
  const gallery = cat.cover_url ? [cat.cover_url, ...heroFallbacks] : heroFallbacks
  const goBack = () => {
    if (Taro.getCurrentPages().length > 1) Taro.navigateBack()
    else Taro.reLaunch({ url: '/pages/index/index' })
  }
  const share = () => {
    Taro.showShareMenu({ withShareTicket: false }).catch(() => undefined)
    void Taro.showToast({ title: '可通过右上角分享给同学', icon: 'none' })
  }
  const toggleFavorite = async () => {
    const next = !isFavorite
    setFavorite(next)
    try {
      await setCatFavorite(cat.id, next)
    } catch (favoriteError) {
      setFavorite(!next)
      void Taro.showToast({ title: favoriteError instanceof Error ? favoriteError.message : '收藏失败', icon: 'none' })
    }
  }

  const sightingsPath = `/pages/cat-atlas/sightings?id=${cat.id}`
  const reportPath = `/pages/cat-atlas/report?id=${cat.id}&name=${encodeURIComponent(cat.name)}`

  return <View className='cat-page cat-detail-page'>
    <View className='cat-detail-hero'>
      <ScrollView
        className='cat-detail-hero__gallery'
        scrollX
        enhanced
        showScrollbar={false}
        onScroll={(event) => {
        const width = event.detail.scrollWidth / gallery.length
        if (width > 0) setGalleryIndex(Math.max(0, Math.min(gallery.length - 1, Math.round(event.detail.scrollLeft / width))))
        }}
      >
        <View className='cat-detail-hero__track'>
          {gallery.map((source, index) => <Image key={`${source}-${index}`} className='cat-detail-hero__image' src={source} mode='aspectFill' />)}
        </View>
      </ScrollView>
      <View className='cat-detail-hero__shade' />
      <View
        className='cat-detail-hero__nav'
        style={{
          top: `${navbarMetrics.statusBarHeight}px`,
          height: `${navbarMetrics.navigationBarHeight}px`,
        }}
      >
        <View className='cat-detail-hero__round-action' ariaLabel='返回' onClick={goBack}><Text>‹</Text></View>
        <View className='cat-detail-hero__nav-right'>
          <View className='cat-detail-hero__round-action' ariaLabel='分享' onClick={share}><Text>↗</Text></View>
          <View className={`cat-detail-hero__round-action ${isFavorite ? 'is-active' : ''}`} ariaLabel='收藏' onClick={() => void toggleFavorite()}><Image src={heartIcon} mode='aspectFit' /></View>
        </View>
      </View>
      <View className='cat-detail-hero__slogan'><Text>在海大的</Text><Text>每一天</Text><Text>都很值得 ♡</Text></View>
      <View className='cat-detail-hero__counter'><Text>▣</Text><Text>{galleryIndex + 1}/{gallery.length}</Text></View>
    </View>

    <View className='cat-detail-sheet'>
      <View className='cat-detail-profile-head'>
        <View className='cat-detail-profile-head__main'>
          <View className='cat-detail-profile-head__name'><Text>{cat.name}</Text><Text className='cat-detail-profile-head__crown'>♛</Text></View>
          <Text className='cat-detail-profile-head__subtitle'>{cat.campus}资深校猫</Text>
          <View className='cat-detail-profile-head__tags'>{cat.traits.map((trait) => <Text key={trait}>{trait}</Text>)}</View>
        </View>
        <View className='cat-detail-profile-head__stat'>
          <View className={`cat-detail-profile-head__favorite ${isFavorite ? 'is-active' : ''}`} onClick={() => void toggleFavorite()}><Image src={heartIcon} mode='aspectFit' /></View>
          <Text>{cat.sighting_count} 人遇见</Text>
        </View>
      </View>

      <View className='cat-detail-quote'><Text>“{cat.resident_area}的太阳，{cat.name}的地盘。”</Text></View>
      <View className='cat-detail-archive'>
        <Text className='cat-detail-archive__title'>基础档案</Text>
        <View className='cat-detail-archive__panel'>{fields.map(([label, value]) => <View className='cat-detail-archive__row' key={label}><Text>{label}</Text><Text>{value}</Text></View>)}</View>
      </View>

      <View className='cat-detail-live-preview'>
        <View className='cat-detail-live-preview__head'><Text>最近动态</Text><Text onClick={() => void navigateToWithGuard(sightingsPath)}>查看全部</Text></View>
        {sightings.length > 0
          ? sightings.map((item) => <View className='cat-detail-live-preview__row' key={item.id}><Text>{item.reporter_name} 在 {item.area} 遇见了它</Text><Text>{item.note || item.activity}</Text></View>)
          : <View className='cat-detail-live-preview__empty'><Text>还没有新的相遇记录</Text><Text>成为第一个记录它的人吧</Text></View>}
      </View>
    </View>
    <View className='cat-detail-bottom'>
      <View className='cat-detail-bottom__actions'>
        <View className='cat-detail-bottom__button cat-detail-bottom__button--activity' onClick={() => void navigateToWithGuard(sightingsPath)}>
          <Image src={eyeIcon} mode='aspectFit' />
          <Text>最近动态</Text>
        </View>
        <View className='cat-detail-bottom__button cat-detail-bottom__button--report' onClick={() => void navigateToWithGuard(reportPath)}>
          <Image src={plusIcon} mode='aspectFit' />
          <Text>我遇到它了</Text>
        </View>
      </View>
    </View>
  </View>
}
