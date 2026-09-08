import { Image, Text, View } from '@tarojs/components'
import { useDidShow, useRouter } from '@tarojs/taro'
import { useCallback, useState } from 'react'
import CustomNavbar from '../../components/custom-navbar'
import { getCat, listCatSightings, type CatView, type SightingView } from '../../api/cat-atlas'
import { RequestState } from '../../features/cat-atlas/ui'
import './shared.scss'

const locationIcon = require('../../assets/icons/location.svg')

export default function CatSightingsPage() {
  const { params } = useRouter()
  const [cat, setCat] = useState<CatView | null>(null); const [items, setItems] = useState<SightingView[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  const load = useCallback(async () => { if (!params.id) { setLoading(false); setError('请选择一只猫后查看动态'); return }; setLoading(true); setError(''); try { const [profile, feed] = await Promise.all([getCat(params.id), listCatSightings(params.id)]); setCat(profile); setItems(feed.items) } catch (loadError) { setError(loadError instanceof Error ? loadError.message : '动态加载失败') } finally { setLoading(false) } }, [params.id])
  useDidShow(() => { void load() })
  return <View className='cat-page'><CustomNavbar title='目击动态' subtitle={cat?.name || '校园目击记录'} showBack /><View className='cat-page__content'>
    <RequestState loading={loading} error={error} empty={!loading && !error && !items.length ? '还没有目击记录' : undefined} onRetry={() => void load()} />
    {items.map((item) => <View key={item.id} className='cat-sighting-card'><View className='cat-sighting-card__head'><View className='cat-sighting-card__avatar'>{item.reporter_name.slice(0, 1)}</View><View><Text>{item.reporter_name}</Text><View className='cat-sighting-card__meta'><Image src={locationIcon} mode='aspectFit' /><Text>{item.area}</Text><Text>{item.created_at.slice(0, 16).replace('T', ' ')}</Text></View></View></View><Text className='cat-sighting-card__content'>{item.note || `它正在${item.activity}`}</Text>{item.photo_url && <Image className='cat-sighting-card__image' src={item.photo_url} mode='aspectFill' />}<View className='cat-sighting-card__foot'><Text>{item.activity}</Text><Text>♡</Text><Text>评论</Text></View></View>)}
  </View></View>
}
