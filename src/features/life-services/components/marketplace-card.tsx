import Taro from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import type { MarketplaceListingView } from '../../../api/types'
import UserAvatarImage from '../../../components/user-avatar-image'
import { requestWechatSubscriptionForModule } from '../../wechat-subscription'
import { formatMoney } from '../format'
import { campusLabel } from '../campus'
import { saveBusinessDetailSnapshot } from '../business-detail-snapshot'
import './marketplace-card.scss'

const openDetail = (item: MarketplaceListingView) => {
  requestWechatSubscriptionForModule('marketplace')
  saveBusinessDetailSnapshot('marketplace', item)
  Taro.navigateTo({ url: `/pages/marketplace/detail?id=${item.id}&snapshot=1` })
}

type Props = {
  item: MarketplaceListingView
  variant?: 'grid' | 'compact'
}

export default function MarketplaceCard({ item, variant = 'grid' }: Props) {
  const cover = item.image_urls?.[0]
  const placeholderTone = Math.abs(item.id) % 4
  const isWanted = item.intent === 'wanted'
  const isPendingOwner = item.viewer_relation === 'owner' && item.status === 'pending_review'
  const authorName = item.author_nickname?.trim() || `发布者 #${item.owner_id}`
  const authorInitial = authorName.trim().slice(0, 1) || '同'

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
      ariaRole='button'
      ariaLabel={`${isWanted ? '求购' : '出售'}，${item.description}，${formatMoney(item.price_cents)}`}
      onClick={() => openDetail(item)}
    >
      <View className={`marketplace-card__cover ${cover ? '' : 'marketplace-card__cover--placeholder'}`}>
        {cover ? (
          <Image src={cover} mode='aspectFill' lazyLoad />
        ) : (
          <View className={`marketplace-card__placeholder marketplace-card__placeholder--tone-${placeholderTone}`}>
            <Text className='marketplace-card__placeholder-kicker'>CAMPUS MARKET</Text>
            <Text className='marketplace-card__placeholder-quote'>“</Text>
            <Text className='marketplace-card__placeholder-headline'>
              {item.description}
            </Text>
          </View>
        )}
        <Text className='marketplace-card__intent'>{isWanted ? '求购' : '出售'}</Text>
        {isPendingOwner && <Text className='marketplace-card__reviewing'>图片审核中</Text>}
      </View>
      <View className='marketplace-card__body'>
        {cover && (
          <Text className='marketplace-card__description'>{item.description}</Text>
        )}
        <View className='marketplace-card__price-line'>
          <Text className='marketplace-card__price'>
            {formatMoney(item.price_cents)}
          </Text>
        </View>
        {variant === 'grid' && item.course_name && (
          <Text className='marketplace-card__course'>{item.course_name}</Text>
        )}
        <View className='marketplace-card__footer'>
          <View className='marketplace-card__author'>
            <View className='marketplace-card__avatar'>
              <UserAvatarImage
                src={item.author_avatar_url}
                className='marketplace-card__avatar-image'
                fallback={authorInitial}
                lazyLoad
              />
            </View>
            <Text>{authorName}</Text>
          </View>
          <Text>{campusLabel(item.campus)}</Text>
        </View>
      </View>
    </View>
  )
}
