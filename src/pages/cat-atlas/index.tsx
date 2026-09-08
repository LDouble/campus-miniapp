import { Image, Text, View } from '@tarojs/components'
import { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useCallback, useMemo, useState } from 'react'
import CustomNavbar from '../../components/custom-navbar'
import { listCats, type CatView } from '../../api/cat-atlas'
import { CatCover, RequestState } from '../../features/cat-atlas/ui'
import { KeyboardSafeInput } from '../../components/keyboard-safe-input'
import { navigateToWithGuard } from '../../utils/navigation'
import './shared.scss'

const searchIcon = require('../../assets/icons/search.svg')
const locationIcon = require('../../assets/icons/location.svg')
const bookIcon = require('../../assets/icons/academic.svg')
const plusIcon = require('../../assets/icons/plus.svg')
const heroImage = require('../../assets/cat-atlas/campus-cats-hero.jpg')
const heartIcon = require('../../assets/community/heart.svg')

const areas = ['全部', '崂山校区', '鱼山校区', '西海岸校区']

export default function CatAtlasPage() {
  const [items, setItems] = useState<CatView[]>([])
  const [total, setTotal] = useState(0)
  const [keyword, setKeyword] = useState('')
  const [area, setArea] = useState('全部')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { const page = await listCats({ keyword: keyword.trim(), area: area === '全部' ? undefined : area }); setItems(page.items); setTotal(page.total) }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : '网络连接不稳定，请稍后重试') }
    finally { setLoading(false) }
  }, [area, keyword])
  useDidShow(() => { void load() })
  usePullDownRefresh(() => load())
  const nearby = useMemo(() => items.slice(0, 3), [items])
  return <View className='cat-page'><CustomNavbar title='猫猫图鉴' subtitle='OUSea' showBack /><View className='cat-page__content cat-page__content--tight'>
    <View className='cat-home-hero'><Image className='cat-home-hero__image' src={heroImage} mode='aspectFill' /><View className='cat-home-hero__veil' /><Text className='cat-home-hero__brand'>OUC 猫猫图鉴</Text><Text className='cat-home-hero__copy'>今天你遇到哪只小猫了？</Text><View className='cat-search'><Image src={searchIcon} mode='aspectFit' /><KeyboardSafeInput value={keyword} placeholder='搜索猫咪 / 地点 / 特征' confirmType='search' onInput={(event) => setKeyword(event.detail.value)} onConfirm={() => void load()} /></View></View>
    <View className='cat-quick-grid'><View className='cat-quick-grid__item' onClick={() => void navigateToWithGuard('/pages/cat-atlas/map')}><View className='cat-quick-grid__icon cat-quick-grid__icon--blue'><Image src={locationIcon} mode='aspectFit' /></View><Text>附近猫猫</Text></View><View className='cat-quick-grid__item' onClick={() => void load()}><View className='cat-quick-grid__icon cat-quick-grid__icon--mint'><Image src={bookIcon} mode='aspectFit' /></View><Text>全部图鉴</Text></View><View className='cat-quick-grid__item' onClick={() => void navigateToWithGuard('/pages/cat-atlas/my-catalog')}><View className='cat-quick-grid__icon cat-quick-grid__icon--orange'><Image src={bookIcon} mode='aspectFit' /></View><Text>我遇到过的</Text></View></View>
    <View className='cat-section'><View className='cat-section__head'><Text className='cat-section__title'>附近正在营业</Text><Text className='cat-section__action' onClick={() => void navigateToWithGuard('/pages/cat-atlas/map')}>出没地图</Text></View><RequestState loading={loading} error={error} onRetry={() => void load()} />{!loading && !error && <View className='cat-nearby-list'>{nearby.map((cat) => <View className='cat-nearby-card' key={cat.id} onClick={() => void navigateToWithGuard(`/pages/cat-atlas/detail?id=${cat.id}`)}><CatCover cat={cat} /><Text>{cat.name}</Text><View className='cat-nearby-card__meta'><Image src={locationIcon} mode='aspectFit' /><Text>{cat.resident_area}</Text></View></View>)}</View>}</View>
    <View className='cat-section'><View className='cat-section__head'><Text className='cat-section__title'>全部图鉴</Text><Text className='cat-muted'>已收录 {total} 只</Text></View><View className='cat-filter-row'>{areas.map((item) => <Text key={item} className={`cat-filter ${area === item ? 'cat-filter--active' : ''}`} onClick={() => setArea(item)}>{item}</Text>)}</View>{!loading && !error && <RequestState empty={items.length === 0 ? '还没有符合条件的猫咪' : undefined} />}{!loading && !error && items.map((cat) => <View key={cat.id} className='cat-list-card' onClick={() => void navigateToWithGuard(`/pages/cat-atlas/detail?id=${cat.id}`)}><CatCover cat={cat} /><View className='cat-list-card__body'><View className='cat-list-card__title'><Text>{cat.name}</Text><Image className='cat-list-card__heart' src={heartIcon} mode='aspectFit' /></View><View className='cat-tags'>{cat.traits.slice(0, 3).map((trait) => <Text key={trait} className='cat-tag'>{trait}</Text>)}</View><View className='cat-list-card__location'><Image src={locationIcon} mode='aspectFit' /><Text>{cat.resident_area}</Text><Text>{cat.sighting_count} 人遇见</Text></View></View></View>)}</View>
    <View className='cat-fab' ariaRole='button' ariaLabel='发现新猫' onClick={() => void navigateToWithGuard('/pages/cat-atlas/report?mode=new')}><Image src={plusIcon} mode='aspectFit' /><Text>发现新猫</Text></View>
  </View></View>
}
