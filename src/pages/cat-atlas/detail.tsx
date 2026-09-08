import { Image, Text, View } from '@tarojs/components'
import { useDidShow, useRouter } from '@tarojs/taro'
import { useCallback, useState } from 'react'
import CustomNavbar from '../../components/custom-navbar'
import { getCat, listCatSightings, type CatView, type SightingView } from '../../api/cat-atlas'
import { CatCover, formatCatDate, RequestState } from '../../features/cat-atlas/ui'
import { navigateToWithGuard } from '../../utils/navigation'
import './shared.scss'

const locationIcon = require('../../assets/icons/location.svg')
const messageIcon = require('../../assets/icons/message.svg')
const eyeIcon = require('../../assets/icons/eye.svg')
const heartIcon = require('../../assets/community/heart.svg')

export default function CatDetailPage() {
  const { params } = useRouter()
  const id = params.id || ''
  const [cat, setCat] = useState<CatView | null>(null)
  const [sightings, setSightings] = useState<SightingView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { const [profile, feed] = await Promise.all([getCat(id), listCatSightings(id)]); setCat(profile); setSightings(feed.items.slice(0, 2)) }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : '暂时无法获取猫咪档案') }
    finally { setLoading(false) }
  }, [id])
  useDidShow(() => { void load() })
  if (loading || error || !cat) return <View className='cat-page'><CustomNavbar title='猫咪详情' showBack /><View className='cat-page__content'><RequestState loading={loading} error={error} onRetry={() => void load()} /></View></View>
  const fields = [['别名', cat.aliases.join(' / ') || '暂无'], ['性别', cat.gender], ['毛色', cat.coat], ['性格', cat.traits.join('、')], ['常驻区域', cat.resident_area], ['首次记录', formatCatDate(cat.first_recorded_at)]]
  return <View className='cat-page'><CustomNavbar title='猫咪详情页' showBack /><View className='cat-detail'>
    <View className='cat-detail__cover'><CatCover cat={cat} large /><View className='cat-detail__cover-note'><Text>校园里的每一次相遇都很珍贵</Text></View></View>
    <View className='cat-detail__sheet'><View className='cat-detail__heading'><View><Text className='cat-detail__title'>{cat.name}</Text><Text className='cat-detail__subtitle'>{cat.resident_area} · {cat.sighting_count} 人遇见</Text></View><Image className='cat-detail__heart' src={heartIcon} mode='aspectFit' /></View><View className='cat-tags'>{cat.traits.map((trait) => <Text key={trait} className='cat-tag'>{trait}</Text>)}</View><Text className='cat-detail__quote'>“下一次的太阳，也想和你一起晒。”</Text>
      <View className='cat-section'><Text className='cat-section__title'>基础档案</Text><View className='cat-profile'>{fields.map(([label, value]) => <View className='cat-profile__row' key={label}><Text className='cat-profile__label'>{label}</Text><Text className='cat-profile__value'>{value}</Text></View>)}</View></View>
      <View className='cat-detail__actions'><View onClick={() => void navigateToWithGuard(`/pages/cat-atlas/map?id=${cat.id}`)}><Image src={locationIcon} mode='aspectFit' /><Text>出没地图</Text></View><View onClick={() => void navigateToWithGuard(`/pages/cat-atlas/sightings?id=${cat.id}`)}><Image src={eyeIcon} mode='aspectFit' /><Text>最近动态</Text></View><View onClick={() => void navigateToWithGuard(`/pages/cat-atlas/sightings?id=${cat.id}`)}><Image src={messageIcon} mode='aspectFit' /><Text>给它留言</Text></View></View>
      {sightings.length > 0 && <View className='cat-section'><View className='cat-section__head'><Text className='cat-section__title'>最近动态</Text><Text className='cat-section__action' onClick={() => void navigateToWithGuard(`/pages/cat-atlas/sightings?id=${cat.id}`)}>查看全部</Text></View>{sightings.map((item) => <View className='cat-mini-feed' key={item.id}><Text>{item.reporter_name} 在 {item.area} 遇见了它</Text><Text>{item.note || item.activity}</Text></View>)}</View>}
    </View><View className='cat-detail__bottom'><View className='cat-primary-button' onClick={() => void navigateToWithGuard(`/pages/cat-atlas/report?id=${cat.id}`)}><Image src={eyeIcon} mode='aspectFit' /><Text>我遇到它了</Text></View></View>
  </View></View>
}
