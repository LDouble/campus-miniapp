import Taro from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import type { MarketplaceListingView } from '../../../api/types'
import { formatMoney, formatStatus } from '../format'

const openDetail = (id: number) => {
  Taro.navigateTo({ url: `/pages/marketplace/detail?id=${id}` })
}

export default function MarketplaceCard({ item }: { item: MarketplaceListingView }) {
  const cover = item.image_urls?.[0]

  return (
    <View
      id={`marketplace-card-${item.id}`}
      className='marketplace-card'
      hoverClass='business-card--pressed'
      onClick={() => openDetail(item.id)}
    >
      <View className='marketplace-card__cover'>
        {cover ? (
          <Image src={cover} mode='aspectFill' lazyLoad />
        ) : (
          <View className='marketplace-card__placeholder'>
            <Text>OUC</Text>
            <Text>校内闲置</Text>
          </View>
        )}
        <Text className='marketplace-card__status'>{formatStatus(item.status)}</Text>
      </View>
      <View className='marketplace-card__body'>
        <Text className='marketplace-card__description'>{item.description}</Text>
        <Text className='marketplace-card__price'>{formatMoney(item.price_cents)}</Text>
        <View className='marketplace-card__footer'>
          <Text>校内面交</Text>
          <Text>查看 ›</Text>
        </View>
      </View>
    </View>
  )
}
