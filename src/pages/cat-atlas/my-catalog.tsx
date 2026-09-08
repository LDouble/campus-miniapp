import { Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import { cats } from '../../features/cat-atlas/data'
import { navigateToWithGuard } from '../../utils/navigation'
import './shared.scss'

export default function MyCatCatalogPage() {
  const seen = cats.slice(0, 1)
  return <View className='cat-page'><CustomNavbar title='我的猫猫图鉴' showBack /><View className='cat-page__content'>
    <View className='cat-hero'><Text className='cat-hero__eyebrow'>我的遇见记录</Text><View className='cat-stat'><Text className='cat-stat__number'>{seen.length} / {cats.length}</Text><Text className='cat-muted'>只猫咪已被你遇见</Text></View><Text className='cat-hero__copy'>多去走走，说不定下一只就在转角晒太阳。</Text></View>
    <View className='cat-section'><View className='cat-section__head'><Text className='cat-section__title'>已遇见</Text><Text className='cat-section__action'>{seen.length} 只</Text></View>{seen.map((cat) => <View className='cat-card' key={cat.id} role='button' onClick={() => void navigateToWithGuard(`/pages/cat-atlas/detail?id=${cat.id}`)}><View className='cat-avatar' style={{ background: cat.color }}>{cat.name.slice(0, 1)}</View><View className='cat-card__body'><Text className='cat-card__name'>{cat.name}</Text><Text className='cat-card__meta'>最近遇见：{cat.lastSeen}</Text></View></View>)}</View>
    <View className='cat-section'><View className='cat-section__head'><Text className='cat-section__title'>等待相遇</Text><Text className='cat-section__action'>{cats.length - seen.length} 只</Text></View>{cats.slice(1).map((cat) => <View className='cat-card' key={cat.id}><View className='cat-avatar' style={{ background: '#A6B2C2' }}>？</View><View className='cat-card__body'><Text className='cat-card__name'>未解锁猫咪</Text><Text className='cat-card__meta'>在校园里发现它，点亮新的图鉴。</Text></View></View>)}</View>
  </View></View>
}
