import { Image, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useState } from 'react'
import { getMyCatCatalog, type CatCatalog, type CatView } from '../../api/cat-atlas'
import { RequestState } from '../../features/cat-atlas/ui'
import { navigateToWithGuard } from '../../utils/navigation'
import './catalog-report.scss'

const referenceCovers = [
  require('../../assets/cat-atlas/stitch/f97d873c34d0485c9dde409ccfbb1170-1.jpg'),
  require('../../assets/cat-atlas/stitch/f97d873c34d0485c9dde409ccfbb1170-2.jpg'),
  require('../../assets/cat-atlas/stitch/f97d873c34d0485c9dde409ccfbb1170-3.jpg'),
  require('../../assets/cat-atlas/stitch/f97d873c34d0485c9dde409ccfbb1170-4.jpg'),
  require('../../assets/cat-atlas/stitch/f97d873c34d0485c9dde409ccfbb1170-5.jpg'),
  require('../../assets/cat-atlas/stitch/f97d873c34d0485c9dde409ccfbb1170-6.jpg'),
  require('../../assets/cat-atlas/stitch/f97d873c34d0485c9dde409ccfbb1170-7.jpg'),
  require('../../assets/cat-atlas/stitch/f97d873c34d0485c9dde409ccfbb1170-8.jpg'),
  require('../../assets/cat-atlas/stitch/f97d873c34d0485c9dde409ccfbb1170-9.jpg'),
  require('../../assets/cat-atlas/stitch/f97d873c34d0485c9dde409ccfbb1170-10.jpg'),
  require('../../assets/cat-atlas/stitch/f97d873c34d0485c9dde409ccfbb1170-11.jpg'),
  require('../../assets/cat-atlas/stitch/f97d873c34d0485c9dde409ccfbb1170-12.jpg'),
]

function CatalogCat({ cat, index, locked }: { cat: CatView; index: number; locked: boolean }) {
  const cover = cat.cover_url || referenceCovers[index % referenceCovers.length]
  const handleClick = () => {
    if (locked) { void Taro.showToast({ title: '先在校园里遇见它吧', icon: 'none' }); return }
    void navigateToWithGuard(`/pages/cat-atlas/detail?id=${cat.id}`)
  }
  return <View className={`catalog-grid__item ${locked ? 'catalog-grid__item--locked' : ''}`} onClick={handleClick}>
    <View className='catalog-grid__photo'><Image src={cover} mode='aspectFill' />{locked && <View className='catalog-grid__lock'><Text>?</Text></View>}</View>
    <Text>{locked ? '未解锁' : cat.name}</Text>
  </View>
}

export default function MyCatCatalogPage() {
  const [catalog, setCatalog] = useState<CatCatalog | null>(null)
  const [tab, setTab] = useState<'seen' | 'unseen'>('seen')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setCatalog(await getMyCatCatalog()) }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : '图鉴加载失败') }
    finally { setLoading(false) }
  }, [])
  useDidShow(() => { void load() })
  const seen = catalog?.seen_cats || []
  const unseen = catalog?.unseen_cats || []
  const display = tab === 'seen' ? seen : unseen
  const percentage = catalog?.total_count ? Math.round(catalog.seen_count / catalog.total_count * 100) : 0

  return <View className='catalog-page'>
    <View className='catalog-nav'>
      <View className='catalog-nav__back' onClick={() => Taro.navigateBack()}><Text>‹</Text></View>
      <Text className='catalog-nav__title'>我的猫猫图鉴</Text>
      <View className='catalog-nav__actions'><Text onClick={() => void Taro.showActionSheet({ itemList: ['分享我的图鉴'] })}>···</Text><View /><Text>⊙</Text></View>
    </View>
    <View className='catalog-page__content'>
      <RequestState loading={loading} error={error} onRetry={() => void load()} />
      {catalog && <>
        <View className='catalog-summary'>
          <View className='catalog-summary__copy'>
            <View><Text>已遇见</Text><Text className='catalog-summary__number'>{catalog.seen_count}</Text><Text>/ {catalog.total_count} 只</Text></View>
            <View className='catalog-summary__track'><View style={{ width: `${percentage}%` }} /></View>
            <Text className='catalog-summary__percent'>{percentage}%</Text>
            <Text className='catalog-summary__hint'>再多走走，说不定下一只就在转角～</Text>
          </View>
          <View className='catalog-summary__cat'><Image src={require('../../assets/cat-atlas/stitch/f97d873c34d0485c9dde409ccfbb1170-1.jpg')} mode='aspectFill' /><Text>✦</Text></View>
        </View>
        <View className='catalog-tabs'><Text className={tab === 'seen' ? 'is-active' : ''} onClick={() => setTab('seen')}>已遇见 ({seen.length})</Text><Text className={tab === 'unseen' ? 'is-active' : ''} onClick={() => setTab('unseen')}>未遇见 ({unseen.length})</Text></View>
        <RequestState empty={!display.length ? (tab === 'seen' ? '还没有点亮图鉴' : '所有猫咪都已遇见') : undefined} />
        <View className='catalog-grid'>{display.map((cat, index) => <CatalogCat key={cat.id} cat={cat} index={index} locked={tab === 'unseen'} />)}</View>
      </>}
    </View>
  </View>
}
