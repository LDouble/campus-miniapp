import { Image, Text, View } from '@tarojs/components'
import { useDidShow, useRouter } from '@tarojs/taro'
import { useCallback, useMemo, useState } from 'react'
import CustomNavbar from '../../components/custom-navbar'
import { getCat, listCats, type CatView } from '../../api/cat-atlas'
import { RequestState } from '../../features/cat-atlas/ui'
import { navigateToWithGuard } from '../../utils/navigation'
import './shared.scss'

const locationIcon = require('../../assets/icons/location.svg')
const eyeIcon = require('../../assets/icons/eye.svg')

const clusters = [
  { name: '一食堂', count: '8 次', left: '28%', top: '32%' },
  { name: '5 号宿舍楼', count: '6 次', left: '58%', top: '52%' },
  { name: '小树林', count: '5 次', left: '36%', top: '66%' },
  { name: '图书馆侧门', count: '4 次', left: '72%', top: '27%' },
]

export default function CatMapPage() {
  const { params } = useRouter(); const [cats, setCats] = useState<CatView[]>([]); const [selected, setSelected] = useState<CatView | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  const load = useCallback(async () => { setLoading(true); setError(''); try { const selectedId = params.id; const [page, profile] = await Promise.all([listCats(), selectedId ? getCat(selectedId) : Promise.resolve(null)]); setCats(page.items); setSelected(profile || page.items[0] || null) } catch (loadError) { setError(loadError instanceof Error ? loadError.message : '地图信息加载失败') } finally { setLoading(false) } }, [params.id])
  useDidShow(() => { void load() })
  const activeClusters = useMemo(() => clusters.slice(0, Math.max(1, Math.min(clusters.length, cats.length))), [cats.length])
  return <View className='cat-page'><CustomNavbar title={selected ? `${selected.name} · 出没地图` : '出没地图'} showBack /><View className='cat-map-page'>
    <RequestState loading={loading} error={error} onRetry={() => void load()} />
    {!loading && !error && <><View className='cat-map-canvas' ariaLabel='仅显示区域级目击热点，不包含精确位置'><Text className='cat-map-canvas__label'>校园区域示意图</Text><Text className='cat-map-canvas__privacy'>为保护猫咪与同学，仅展示区域级热点</Text>{activeClusters.map((item) => <View key={item.name} className='cat-map-pin' style={{ left: item.left, top: item.top }} onClick={() => void setSelected(cats.find((cat) => cat.resident_area.includes(item.name.slice(0, 2))) || selected)}><View><Image src={locationIcon} mode='aspectFit' /></View><Text>{item.name}</Text></View>)}</View>
      {selected && <View className='cat-map-summary'><View><Text className='cat-map-summary__name'>{selected.name}</Text><Text>{selected.resident_area}</Text></View><View className='cat-map-summary__count'><Image src={eyeIcon} mode='aspectFit' /><Text>{selected.sighting_count} 人遇见</Text></View><View className='cat-map-summary__button' onClick={() => void navigateToWithGuard(`/pages/cat-atlas/report?id=${selected.id}`)}>我遇到它了</View></View>}
      <View className='cat-map-list'><Text className='cat-section__title'>它最常出现的地点</Text>{activeClusters.map((item) => <View key={item.name}><Text>{item.name}</Text><Text>最近 7 天出现 {item.count}</Text></View>)}</View></>}
  </View></View>
}
