import { Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import { navigateToWithGuard } from '../../utils/navigation'
import { cats } from '../../features/cat-atlas/data'
import './shared.scss'

export default function CatAtlasPage() {
  return <View className='cat-page'>
    <CustomNavbar title='猫猫图鉴' subtitle='校园里的小居民' showBack />
    <View className='cat-page__content'>
      <View className='cat-hero'><Text className='cat-hero__eyebrow'>OUSea Cat Atlas</Text><Text className='cat-hero__title'>认识每一位猫同学</Text><Text className='cat-hero__copy'>已收录 {cats.length} 只，遇见它们也记得留下温柔的一笔。</Text></View>
      <View className='cat-section'><View className='cat-section__head'><Text className='cat-section__title'>全部图鉴</Text><Text className='cat-section__action' onClick={() => void navigateToWithGuard('/pages/cat-atlas/my-catalog')}>我的图鉴</Text></View>
        {cats.map((cat) => <View key={cat.id} className='cat-card' role='button' onClick={() => void navigateToWithGuard(`/pages/cat-atlas/detail?id=${cat.id}`)}><View className='cat-avatar' style={{ background: cat.color }}>{cat.name.slice(0, 1)}</View><View className='cat-card__body'><Text className='cat-card__name'>{cat.name}</Text><Text className='cat-card__meta'>{cat.area} · {cat.seenCount} 人遇见</Text><View className='cat-tags'>{cat.traits.map((trait) => <Text key={trait} className='cat-tag'>{trait}</Text>)}</View></View></View>)}
      </View>
      <View className='cat-primary-button' role='button' onClick={() => void navigateToWithGuard('/pages/cat-atlas/report?mode=new')}>发现新猫</View>
    </View>
  </View>
}
