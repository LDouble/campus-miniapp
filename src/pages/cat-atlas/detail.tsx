import { Text, View } from '@tarojs/components'
import { useRouter } from '@tarojs/taro'
import CustomNavbar from '../../components/custom-navbar'
import { getCat, sightings } from '../../features/cat-atlas/data'
import { navigateToWithGuard } from '../../utils/navigation'
import './shared.scss'

export default function CatDetailPage() {
  const { params } = useRouter()
  const cat = getCat(params.id)
  const fields = [['别名', cat.alias], ['性别', cat.gender], ['毛色', cat.coat], ['性格', cat.traits.join('、')], ['常驻区域', cat.area], ['首次记录', cat.firstSeen]]
  return <View className='cat-page'><CustomNavbar title='猫咪详情' showBack /><View className='cat-page__content'>
    <View className='cat-avatar' style={{ width: '100%', height: '300rpx', borderRadius: '36rpx', background: cat.color, fontSize: '120rpx' }}>{cat.name.slice(0, 1)}</View>
    <Text className='cat-detail__title'>{cat.name} <Text style={{ color: '#E6A23C', fontSize: '30rpx' }}>♛</Text></Text><Text className='cat-detail__subtitle'>{cat.area} · {cat.seenCount} 人遇见</Text>
    <View className='cat-tags'>{cat.traits.map((trait) => <Text key={trait} className='cat-tag'>{trait}</Text>)}</View>
    <View className='cat-profile'>{fields.map(([label, value]) => <View className='cat-profile__row' key={label}><Text className='cat-profile__label'>{label}</Text><Text className='cat-profile__value'>{value}</Text></View>)}</View>
    <View className='cat-section'><View className='cat-section__head'><Text className='cat-section__title'>最近动态</Text><Text className='cat-section__action' onClick={() => void navigateToWithGuard(`/pages/cat-atlas/sightings?id=${cat.id}`)}>查看全部</Text></View>{sightings.filter((item) => item.catId === cat.id).slice(0, 1).map((item) => <View className='cat-card' key={item.id}><View className='cat-card__body'><Text className='cat-card__name'>{item.user} · {item.activity}</Text><Text className='cat-card__meta'>{item.area} · {item.time}</Text><Text className='cat-card__meta'>{item.note}</Text></View></View>)}</View>
    <View className='cat-primary-button' role='button' onClick={() => void navigateToWithGuard(`/pages/cat-atlas/report?id=${cat.id}`)}>我遇到它了</View>
  </View></View>
}
