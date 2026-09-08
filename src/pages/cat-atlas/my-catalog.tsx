import { Text, View } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { useCallback, useState } from 'react'
import CustomNavbar from '../../components/custom-navbar'
import { getMyCatCatalog, type CatCatalog } from '../../api/cat-atlas'
import { CatCover, RequestState } from '../../features/cat-atlas/ui'
import { navigateToWithGuard } from '../../utils/navigation'
import './shared.scss'

export default function MyCatCatalogPage() {
  const [catalog, setCatalog] = useState<CatCatalog | null>(null); const [tab, setTab] = useState<'seen' | 'unseen'>('seen'); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  const load = useCallback(async () => { setLoading(true); setError(''); try { setCatalog(await getMyCatCatalog()) } catch (loadError) { setError(loadError instanceof Error ? loadError.message : '图鉴加载失败') } finally { setLoading(false) } }, [])
  useDidShow(() => { void load() })
  const seen = catalog?.seen_cats || []; const unseen = catalog?.unseen_cats || []; const display = tab === 'seen' ? seen : unseen
  return <View className='cat-page'><CustomNavbar title='我的猫猫图鉴' showBack /><View className='cat-page__content'>
    <RequestState loading={loading} error={error} onRetry={() => void load()} />
    {catalog && <><View className='cat-catalog-hero'><Text>已遇见 <Text>{catalog.seen_count} / {catalog.total_count}</Text> 只</Text><View className='cat-catalog-hero__progress'><View style={{ width: `${catalog.total_count ? Math.round(catalog.seen_count / catalog.total_count * 100) : 0}%` }} /></View><Text>再多走走，说不定下一只就在转角。</Text></View><View className='cat-catalog-tabs'><Text className={tab === 'seen' ? 'is-active' : ''} onClick={() => setTab('seen')}>已遇见 ({seen.length})</Text><Text className={tab === 'unseen' ? 'is-active' : ''} onClick={() => setTab('unseen')}>未遇见 ({unseen.length})</Text></View><RequestState empty={!display.length ? (tab === 'seen' ? '还没有点亮图鉴' : '所有猫咪都已遇见') : undefined} />{display.map((cat) => <View className={`cat-catalog-card ${tab === 'unseen' ? 'cat-catalog-card--locked' : ''}`} key={cat.id} onClick={() => tab === 'seen' && void navigateToWithGuard(`/pages/cat-atlas/detail?id=${cat.id}`)}><CatCover cat={cat} /><View><Text>{tab === 'seen' ? cat.name : '未解锁猫咪'}</Text><Text>{tab === 'seen' ? `最近遇见：${cat.last_seen_at?.slice(0, 10) || '暂未记录'}` : '在校园里发现它，点亮新的图鉴。'}</Text></View></View>)}</>}
  </View></View>
}
