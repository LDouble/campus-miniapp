import { Image, Text, View } from '@tarojs/components'
import { useDidShow, useRouter } from '@tarojs/taro'
import { useCallback, useMemo, useState } from 'react'
import CustomNavbar from '../../components/custom-navbar'
import { getCat, listCatHotspots, type CatHotspot, type CatView } from '../../api/cat-atlas'
import { RequestState } from '../../features/cat-atlas/ui'
import { navigateToWithGuard } from '../../utils/navigation'
import './shared.scss'
import './warm-theme.scss'

const locationIcon = require('../../assets/icons/location-warm.svg')
const eyeIcon = require('../../assets/icons/eye-warm.svg')

const clusterPositions = [
  { left: '28%', top: '32%' },
  { left: '58%', top: '52%' },
  { left: '36%', top: '66%' },
  { left: '72%', top: '27%' },
]

export default function CatMapPage() {
  const { params } = useRouter(); const [selected, setSelected] = useState<CatView | null>(null); const [hotspots, setHotspots] = useState<CatHotspot[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  const load = useCallback(async () => { setLoading(true); setError(''); try { if (!params.id) throw new Error('请选择一只猫后查看出没地图'); const [profile, rows] = await Promise.all([getCat(params.id), listCatHotspots(params.id)]); setSelected(profile); setHotspots(rows) } catch (loadError) { setError(loadError instanceof Error ? loadError.message : '地图信息加载失败') } finally { setLoading(false) } }, [params.id])
  useDidShow(() => { void load() })
  const activeClusters = useMemo(() => hotspots.slice(0, clusterPositions.length).map((item, index) => ({ ...item, ...clusterPositions[index] })), [hotspots])
  return <View className='cat-page'><CustomNavbar title={selected ? `${selected.name} · 出没地图` : '出没地图'} showBack /><View className='cat-map-page'>
    <RequestState loading={loading} error={error} onRetry={() => void load()} />
    {!loading && !error && <><View className='cat-map-canvas' ariaLabel='仅显示区域级目击热点，不包含精确位置'><Text className='cat-map-canvas__label'>校园区域示意图</Text><Text className='cat-map-canvas__privacy'>为保护猫咪与同学，仅展示区域级热点</Text>{activeClusters.map((item) => <View key={item.area} className='cat-map-pin' style={{ left: item.left, top: item.top }}><View><Image src={locationIcon} mode='aspectFit' /></View><Text>{item.area}</Text></View>)}</View>
      {selected && <View className='cat-map-summary'><View><Text className='cat-map-summary__name'>{selected.name}</Text><Text>{selected.resident_area}</Text></View><View className='cat-map-summary__count'><Image src={eyeIcon} mode='aspectFit' /><Text>{selected.sighting_count} 人遇见</Text></View><View className='cat-map-summary__button' onClick={() => void navigateToWithGuard(`/pages/cat-atlas/report?id=${selected.id}&name=${encodeURIComponent(selected.name)}`)}>我遇到它了</View></View>}
      <View className='cat-map-list'><Text className='cat-section__title'>它最常出现的地点</Text>{activeClusters.map((item) => <View key={item.area}><Text>{item.area}</Text><Text>最近 7 天出现 {item.sighting_count} 次</Text></View>)}</View></>}
  </View></View>
}
