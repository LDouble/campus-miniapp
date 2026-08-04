import Taro from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import type { MarketplaceListingView } from '../../../api/types'
import { requestWechatSubscriptionForModule } from '../../wechat-subscription'
import { formatMoney, formatStatus } from '../format'
import './marketplace-card.scss'

const openDetail = (id: number) => {
  requestWechatSubscriptionForModule('marketplace')
  Taro.navigateTo({ url: `/pages/marketplace/detail?id=${id}` })
}

type Props = {
  item: MarketplaceListingView
  variant?: 'grid' | 'compact'
}

export default function MarketplaceCard({ item, variant = 'grid' }: Props) {
  const cover = item.image_urls?.[0]
  const placeholderTone = Math.abs(item.id) % 4
  const isWanted = item.intent === 'wanted'

  return (
    <View
      id={`marketplace-card-${item.id}`}
      className={[
        'marketplace-card',
        `marketplace-card--${variant}`,
        cover ? '' : 'marketplace-card--no-image',
        isWanted ? 'marketplace-card--wanted' : 'marketplace-card--sell',
      ].filter(Boolean).join(' ')}
      hoverClass='marketplace-card--pressed'
      onClick={() => openDetail(item.id)}
    >
      <View className={`marketplace-card__cover ${cover ? '' : 'marketplace-card__cover--placeholder'}`}>
        {cover ? (
          <Image src={cover} mode='aspectFill' lazyLoad />
        ) : (
          <View className={`marketplace-card__placeholder marketplace-card__placeholder--tone-${placeholderTone}`}>
            <Text className='marketplace-card__placeholder-quote'>“</Text>
            <Text className='marketplace-card__placeholder-headline'>
              {item.description}
            </Text>
          </View>
        )}
        {cover && (
          <Text className='marketplace-card__status'>{formatStatus(item.status)}</Text>
        )}
      </View>
      <View className='marketplace-card__body'>
        {cover && (
          <Text className='marketplace-card__description'>{item.description}</Text>
        )}
        <View className='marketplace-card__price-line'>
          <Text className='marketplace-card__intent'>{isWanted ? '求购' : '出售'}</Text>
          <Text className='marketplace-card__price'>
            {isWanted ? '预算 ' : ''}{formatMoney(item.price_cents)}
          </Text>
        </View>
        {item.course_name && <Text className='marketplace-card__course'>{item.course_name}</Text>}
        <View className='marketplace-card__footer'>
          <Text>校内面交</Text>
          <Text>查看 ›</Text>
        </View>
      </View>
    </View>
  )
}
