import { Image, Text, View } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { useCallback, useMemo, useState } from 'react'
import CustomNavbar from '../../components/custom-navbar'
import { getCat, listCatSightings, type CatView, type SightingView } from '../../api/cat-atlas'
import { formatCatDate, RequestState } from '../../features/cat-atlas/ui'
import { useCollapsingHeader } from '../../hooks/use-collapsing-header'
import { navigateToWithGuard } from '../../utils/navigation'
import './atlas.scss'

const detailMoreIcon = require('../../assets/cat-atlas/figma/detail-more.svg')
const detailCloseIcon = require('../../assets/cat-atlas/figma/detail-close.svg')
const detailPhotoIcon = require('../../assets/cat-atlas/figma/detail-location.svg')
const detailAlbumIcon = require('../../assets/cat-atlas/figma/detail-album.svg')
const detailChevronIcon = require('../../assets/cat-atlas/figma/detail-chevron.svg')
const detailLocationIcon = require('../../assets/cat-atlas/figma/detail-profile-location.svg')
const detailActivityIcon = require('../../assets/cat-atlas/figma/detail-activity.svg')
const detailPlusIcon = require('../../assets/cat-atlas/figma/detail-plus.svg')
const detailEmptyCatIcon = require('../../assets/cat-atlas/figma/detail-empty-cat.svg')

const compactArea = (area: string) => area.length > 24 ? `${area.slice(0, 24)}…` : area

const formatTimelineTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const clock = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  if (isToday) return clock
  if (date.toDateString() === yesterday.toDateString()) return `昨天 ${clock}`
  return `${date.getMonth() + 1}/${date.getDate()} ${clock}`
}

const uniquePhotos = (photos: Array<string | null | undefined>) => Array.from(new Set(photos.filter((photo): photo is string => Boolean(photo))))

function HeaderActions({ onClose }: { onClose: () => void }) {
  return <View className='cat-detail-nav-pill'>
    <View className='cat-detail-nav-pill__item'><Image src={detailMoreIcon} mode='aspectFit' /></View>
    <View className='cat-detail-nav-pill__divider' />
    <View className='cat-detail-nav-pill__item' onClick={onClose}><Image src={detailCloseIcon} mode='aspectFit' /></View>
  </View>
}

export default function CatDetailPage() {
  const { params } = useRouter()
  const id = params.id || ''
  const [cat, setCat] = useState<CatView | null>(null)
  const [sightings, setSightings] = useState<SightingView[]>([])
  const [galleryPhotos, setGalleryPhotos] = useState<string[]>([])
  const [activePhoto, setActivePhoto] = useState(0)
  const [brokenPhotos, setBrokenPhotos] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // 保留滚动状态契约，但详情稿的标题栏始终展示，不再切换成沉浸式透明态。
  const headerCollapsed = useCollapsingHeader({ threshold: 320, releaseGap: 56 })

  const goBack = useCallback(() => {
    if (Taro.getCurrentPages().length > 1) Taro.navigateBack()
    else Taro.reLaunch({ url: '/pages/index/index' })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [profile, feed] = await Promise.all([getCat(id), listCatSightings(id)])
      setCat(profile)
      setSightings(feed.items.slice(0, 2))
      setGalleryPhotos(uniquePhotos([profile.cover_url, ...feed.items.map((item) => item.photo_url)]))
      setBrokenPhotos([])
      setActivePhoto(0)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '暂时无法获取猫咪档案')
    } finally {
      setLoading(false)
    }
  }, [id])

  useDidShow(() => { void load() })

  const visiblePhotos = useMemo(
    () => galleryPhotos.filter((photo) => !brokenPhotos.includes(photo)),
    [brokenPhotos, galleryPhotos],
  )
  const hasPhotos = visiblePhotos.length > 0
  const selectedPhoto = visiblePhotos[Math.min(activePhoto, Math.max(visiblePhotos.length - 1, 0))]
  const detailNav = <HeaderActions onClose={goBack} />

  if (loading || error || !cat) {
    return <View className='cat-page cat-detail-page'>
      <CustomNavbar title='猫咪档案' showBack onBack={goBack} immersive={!headerCollapsed} collapsed={headerCollapsed} rightContent={detailNav} />
      <View className='cat-page__content cat-detail-state'><RequestState loading={loading} error={error} onRetry={() => void load()} /></View>
    </View>
  }

  const fields = [
    ['别名', cat.aliases.join(' / ') || '暂无'],
    ['性别', cat.gender || '未知'],
    ['毛色', cat.coat || '未知'],
    ['性格', cat.traits.join('、') || '暂无'],
    ['常驻区域', cat.resident_area || '暂无'],
    ['首次记录', formatCatDate(cat.first_recorded_at)],
  ]
  const sightingsPath = `/pages/cat-atlas/sightings?id=${cat.id}`
  const reportPath = `/pages/cat-atlas/report?id=${cat.id}&name=${encodeURIComponent(cat.name)}`
  const supplementPath = `/pages/cat-atlas/profile-suggestion?id=${cat.id}&name=${encodeURIComponent(cat.name)}`

  const markPhotoBroken = (source: string) => {
    setBrokenPhotos((current) => current.includes(source) ? current : [...current, source])
    setActivePhoto(0)
  }

  return <View className='cat-page cat-detail-page'>
    <CustomNavbar title='猫咪档案' showBack onBack={goBack} immersive={!headerCollapsed} collapsed={headerCollapsed} rightContent={detailNav} />

    <View className='cat-detail-main'>
      <View className={`cat-detail-visual-card ${hasPhotos ? 'cat-detail-visual-card--photo' : 'cat-detail-visual-card--empty'}`}>
        {hasPhotos ? <>
          <View className='cat-detail-media'>
            <Image
              className='cat-detail-media__image'
              src={selectedPhoto}
              mode='aspectFill'
              onError={() => markPhotoBroken(selectedPhoto)}
              onClick={() => void Taro.previewImage({ urls: visiblePhotos, current: selectedPhoto })}
            />
            <View className='cat-detail-media__gradient' />
            <View className='cat-detail-media__status'><View /><Text>在校活动中</Text></View>
            <View className='cat-detail-media__footer'>
              <View className='cat-detail-media__dots'>
                {visiblePhotos.slice(0, 4).map((photo, index) => <View key={photo} className={index === activePhoto ? 'is-active' : ''} />)}
              </View>
              <View className='cat-detail-media__counter'><Image src={detailPhotoIcon} mode='aspectFit' /><Text>{Math.min(activePhoto + 1, visiblePhotos.length)}/{visiblePhotos.length} 照</Text></View>
            </View>
          </View>
          <View className='cat-detail-album'>
            <View className='cat-detail-album__head'>
              <View><Image src={detailAlbumIcon} mode='aspectFit' /><Text>相册精选 ({visiblePhotos.length})</Text></View>
              <Text onClick={() => void Taro.previewImage({ urls: visiblePhotos, current: selectedPhoto })}>查看图集 <Text>›</Text></Text>
            </View>
            <View className='cat-detail-album__grid'>
              {visiblePhotos.slice(0, visiblePhotos.length > 4 ? 3 : 4).map((photo, index) => <View key={photo} className={`cat-detail-album__thumb ${index === activePhoto ? 'is-active' : ''}`} onClick={() => setActivePhoto(index)}><Image src={photo} mode='aspectFill' onError={() => markPhotoBroken(photo)} /></View>)}
              {visiblePhotos.length > 4 && <View className='cat-detail-album__thumb cat-detail-album__thumb--more' onClick={() => void Taro.previewImage({ urls: visiblePhotos, current: selectedPhoto })}>
                <Image src={visiblePhotos[3]} mode='aspectFill' />
                <View><Text>+{visiblePhotos.length - 3}</Text><Text>全部</Text></View>
              </View>}
            </View>
          </View>
        </> : <>
          <View className='cat-detail-empty-visual'>
            <View className='cat-detail-empty-visual__icon'><Image src={detailEmptyCatIcon} mode='aspectFit' /></View>
            <Text>{cat.name}</Text>
            <Text>它的故事，等你来记录</Text>
          </View>
          <View className='cat-detail-empty-visual__note'><View /><Text>尚未收录照片 · 期待首次记录</Text></View>
        </>}
      </View>

      <View className='cat-detail-profile-card'>
        <View className='cat-detail-profile-card__copy'>
          <Text className='cat-detail-profile-card__name'>{cat.name}</Text>
          <View className='cat-detail-profile-card__location'><Image src={detailLocationIcon} mode='aspectFit' /><Text>{cat.campus}</Text><Text>·</Text><Text>{cat.coat}</Text></View>
          <View className='cat-detail-profile-card__tags'>{cat.traits.slice(0, 3).map((trait) => <Text key={trait}>{trait}</Text>)}</View>
        </View>
        <View className='cat-detail-profile-card__stat'><Text>{cat.sighting_count}</Text><Text>次相遇</Text></View>
      </View>

      <View className='cat-detail-archive-section'>
        <View className='cat-detail-section-heading'><View className='cat-detail-section-heading__marker' /><Text>基础档案</Text></View>
        <View className='cat-detail-archive-card'>
          <View className='cat-detail-archive-card__rows'>{fields.map(([label, value]) => <View className='cat-detail-archive-card__row' key={label}><Text>{label}</Text><Text>{value}</Text></View>)}</View>
          <View className='cat-detail-archive-card__suggestion' onClick={() => void navigateToWithGuard(supplementPath)}>
            <View><Text>档案信息有补充？</Text><Text>别名、性别、毛色和常驻区域都可以提交建议</Text></View>
            <View><Text>去补充</Text><Image src={detailChevronIcon} mode='aspectFit' /></View>
          </View>
        </View>
      </View>

      <View className='cat-detail-sightings-section'>
        <View className='cat-detail-section-heading cat-detail-sightings-heading'>
          <View className='cat-detail-sightings-heading__copy'>
            <View className='cat-detail-sightings-heading__title-row'><View className='cat-detail-section-heading__marker' /><Text>最近动态</Text></View>
            <Text className='cat-detail-sightings-heading__subtitle'>同学们记录的相遇瞬间</Text>
          </View>
          <View onClick={() => void navigateToWithGuard(sightingsPath)}><Text>查看全部</Text><Image src={detailChevronIcon} mode='aspectFit' /></View>
        </View>
        <View className='cat-detail-sighting-list'>
          {sightings.map((item) => <View className='cat-detail-sighting-card' key={item.id}>
            <View className='cat-detail-sighting-card__meta'><Text>{item.reporter_name || '匿名同学'}</Text><Text>{compactArea(item.area) || '暂无地点'} · {formatTimelineTime(item.created_at)}</Text></View>
            {item.activity && <View className='cat-detail-sighting-card__activity cat-detail-live-preview__activity'><Text>它在{item.activity}</Text></View>}
            {item.note && <Text className='cat-detail-sighting-card__note'>{item.note}</Text>}
            {item.photo_url && <View className='cat-detail-sighting-card__photos'><Image src={item.photo_url} mode='aspectFill' onError={() => markPhotoBroken(item.photo_url!)} /></View>}
          </View>)}
          {!sightings.length && <View className='cat-detail-sightings-empty'><Text>还没有新的相遇记录</Text><Text>成为第一个记录它的人吧</Text></View>}
          <View className='cat-detail-sighting-compose cat-detail-live-preview__compose' onClick={() => void navigateToWithGuard(reportPath)}>
            <View><Text>我也遇见它了 <Text>🐾</Text></Text><Text>{hasPhotos ? '补充它此刻在做什么、上传抓拍照片' : '补充它此刻在做什么、在哪里'}</Text></View>
            <View className='cat-detail-sighting-compose__arrow'><Image src={detailChevronIcon} mode='aspectFit' /></View>
          </View>
        </View>
      </View>
    </View>

    <View className='cat-detail-bottom'>
      <View className='cat-detail-bottom__actions'>
        <View className='cat-detail-bottom__button cat-detail-bottom__button--activity' onClick={() => void navigateToWithGuard(sightingsPath)}><Image src={detailActivityIcon} mode='aspectFit' /><Text>最近动态</Text></View>
        <View className='cat-detail-bottom__button cat-detail-bottom__button--report' onClick={() => void navigateToWithGuard(reportPath)}><Image src={detailPlusIcon} mode='aspectFit' /><Text>我遇到它了</Text></View>
      </View>
    </View>
  </View>
}
