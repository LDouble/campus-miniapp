import { Text, View } from '@tarojs/components'
import { useRouter } from '@tarojs/taro'
import CustomNavbar from '../../components/custom-navbar'
import { getCat, sightings } from '../../features/cat-atlas/data'
import './shared.scss'

export default function CatSightingsPage() {
  const { params } = useRouter()
  const cat = getCat(params.id)
  const items = sightings.filter((item) => !params.id || item.catId === cat.id)
  return <View className='cat-page'><CustomNavbar title='目击动态' subtitle={params.id ? cat.name : '全校最新记录'} showBack /><View className='cat-page__content'>
    {items.map((item) => <View key={item.id} className='cat-card'><View className='cat-avatar' style={{ width: '72rpx', height: '72rpx', flexBasis: '72rpx', borderRadius: '50%', background: getCat(item.catId).color, fontSize: '30rpx' }}>{item.user.slice(0, 1)}</View><View className='cat-card__body'><Text className='cat-card__name'>{item.user} 遇见了 {getCat(item.catId).name}</Text><Text className='cat-card__meta'>{item.area} · {item.time} · {item.activity}</Text><Text className='cat-card__meta'>{item.note}</Text></View></View>)}
    {!items.length && <Text className='cat-muted'>还没有目击记录，成为第一个记录它的人吧。</Text>}
  </View></View>
}
