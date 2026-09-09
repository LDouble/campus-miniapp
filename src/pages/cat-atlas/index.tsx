import { Image, Text, View } from '@tarojs/components'
import { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useCallback, useMemo, useState } from 'react'
import CustomNavbar from '../../components/custom-navbar'
import { listCats, type CatView } from '../../api/cat-atlas'
import { CatCover, RequestState } from '../../features/cat-atlas/ui'
import { KeyboardSafeInput } from '../../components/keyboard-safe-input'
import { navigateToWithGuard } from '../../utils/navigation'
import './home-list.scss'

const searchIcon = require('../../assets/icons/search.svg')
const locationIcon = require('../../assets/icons/location.svg')
const bookIcon = require('../../assets/icons/academic.svg')
const plusIcon = require('../../assets/icons/plus.svg')
const heroImage = require('../../assets/cat-atlas/stitch/4a441027c1f341dc9c5a1e33b7061dc4-1.jpg')

export default function CatAtlasPage() {
  const [items, setItems] = useState<CatView[]>([])
  const [total, setTotal] = useState(0)
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const page = await listCats({ keyword: keyword.trim(), pageSize: 30 })
      setItems(page.items)
      setTotal(page.total)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '网络连接不稳定，请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [keyword])
  useDidShow(() => { void load() })
  usePullDownRefresh(() => load())
  const nearby = useMemo(() => items.slice(0, 3), [items])
  const featured = nearby[0]

  return <View className='cat-home-page'>
    <CustomNavbar title='猫猫图鉴' subtitle='OUSea' />
    <View className='cat-home-page__scroll'>
      <View className='cat-home-hero-v2'>
        <Image className='cat-home-hero-v2__image' src={heroImage} mode='aspectFill' />
        <View className='cat-home-hero-v2__veil' />
        <Text className='cat-home-hero-v2__eyebrow'>OUSea</Text>
        <View className='cat-home-hero-v2__title-row'><Text className='cat-home-hero-v2__title'>OUC 猫猫图鉴</Text><Text className='cat-home-hero-v2__crown'>✦</Text></View>
        <Text className='cat-home-hero-v2__copy'>今天你遇到哪只猫了？</Text>
        <View className='cat-home-search'><Image src={searchIcon} mode='aspectFit' /><KeyboardSafeInput value={keyword} placeholder='搜索猫咪 / 地点 / 关键词' confirmType='search' onInput={(event) => setKeyword(event.detail.value)} onConfirm={() => void load()} /></View>
      </View>
      <View className='cat-home-shortcuts'>
        <View className='cat-home-shortcuts__item' onClick={() => void navigateToWithGuard('/pages/cat-atlas/map')}><View className='cat-home-shortcuts__icon cat-home-shortcuts__icon--blue'><Image src={locationIcon} mode='aspectFit' /></View><Text>附近猫咪</Text></View>
        <View className='cat-home-shortcuts__item' onClick={() => void navigateToWithGuard('/pages/cat-atlas/list')}><View className='cat-home-shortcuts__icon cat-home-shortcuts__icon--mint'><Image src={bookIcon} mode='aspectFit' /></View><Text>全部图鉴</Text></View>
        <View className='cat-home-shortcuts__item' onClick={() => void navigateToWithGuard('/pages/cat-atlas/my-catalog')}><View className='cat-home-shortcuts__icon cat-home-shortcuts__icon--orange'><Image src={bookIcon} mode='aspectFit' /></View><Text>我遇到过的</Text></View>
      </View>
      <View className='cat-home-section'>
        <View className='cat-home-section__head'><Text>附近正在营业</Text><Text onClick={() => void navigateToWithGuard('/pages/cat-atlas/list')}>查看全部</Text></View>
        <RequestState loading={loading} error={error} onRetry={() => void load()} />
        {!loading && !error && <View className='cat-home-nearby'>{nearby.map((cat) => <View className='cat-home-nearby__card' key={cat.id} onClick={() => void navigateToWithGuard(`/pages/cat-atlas/detail?id=${cat.id}`)}><CatCover cat={cat} /><Text className='cat-home-nearby__name'>{cat.name}</Text><View className='cat-home-nearby__meta'><Image src={locationIcon} mode='aspectFit' /><Text>{cat.resident_area}</Text></View></View>)}</View>}
      </View>
      {!loading && !error && featured && <View className='cat-home-section cat-home-section--feed'><Text className='cat-home-section__feed-title'>大家最近遇见了它们</Text><View className='cat-home-encounter' onClick={() => void navigateToWithGuard(`/pages/cat-atlas/detail?id=${featured.id}`)}><View className='cat-home-encounter__avatar'><Text>{featured.name.slice(0, 1)}</Text></View><View className='cat-home-encounter__body'><Text>同学在 {featured.resident_area} 遇到了 <Text>{featured.name}</Text></Text><Text>最近有新的目击记录，去看看它吧</Text></View><CatCover cat={featured} /></View></View>}
      {!loading && !error && !items.length && <RequestState empty='还没有符合条件的猫咪' />}
      <Text className='cat-home-page__hint'>已收录 {total} 只校园猫咪，持续更新中</Text>
    </View>
    <View className='cat-home-fab' ariaRole='button' ariaLabel='发现新猫' onClick={() => void navigateToWithGuard('/pages/cat-atlas/report?mode=new')}><Image src={plusIcon} mode='aspectFit' /><Text>发现新猫</Text></View>
  </View>
}
