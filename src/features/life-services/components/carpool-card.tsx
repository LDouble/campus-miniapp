import { Image, Text, View } from '@tarojs/components'
import type { CarpoolTripView } from '../../../api/types'
import UserAvatar from '../../../components/user-avatar'
import StickerContent from '../../../components/sticker-content'
import { requestWechatSubscriptionForModule } from '../../wechat-subscription'
import BusinessRoute from './business-route'
import { saveBusinessDetailSnapshot } from '../business-detail-snapshot'
import { navigateToWithGuard } from '../../../utils/navigation'
import {
  formatDateTime,
  formatStatus,
  remainingSeats,
} from '../format'

const moreIcon = require('../../../assets/icons/more-horizontal.svg')

const openDetail = (item: CarpoolTripView) => {
  requestWechatSubscriptionForModule('carpool')
  saveBusinessDetailSnapshot('carpool', item)
  void navigateToWithGuard(`/pages/carpool/detail?id=${item.id}&snapshot=1`)
}

export default function CarpoolCard({ item }: { item: CarpoolTripView }) {
  const seats = remainingSeats(item.total_seats, item.occupied_seats)
  const departure = formatDateTime(item.departure_at)
  const authorName = item.author_nickname?.trim() || `发起人 #${item.organizer_id}`
  const authorInitial = authorName.trim().slice(0, 1) || '同'

  return (
    <View
      id={`carpool-card-${item.id}`}
      className='carpool-card'
      onClick={() => openDetail(item)}
    >
      <View className='business-card-header'>
        <UserAvatar
          src={item.author_avatar_url}
          className='business-card-avatar business-card-avatar--carpool'
          imageClassName='business-card-avatar__image'
          fallback={authorInitial}
          userId={item.organizer_id}
          lazyLoad
        />
        <View className='business-card-identity'>
          <View>
            <Text>{authorName}</Text>
            <Text className='business-status business-status--carpool'>
              {formatStatus(item.status, item.review_status)}
            </Text>
          </View>
        </View>
        <Image className='business-card-more' src={moreIcon} mode='aspectFit' />
      </View>

      {item.description && (
        <StickerContent
          content={item.description}
          className='carpool-card__description'
          stickerClassName='business-card__sticker'
        />
      )}
      <BusinessRoute
        startLabel='出发地'
        start={item.origin}
        endLabel='目的地'
        end={item.destination}
      />

      <View className='carpool-card__footer'>
        <Text>{departure} 出发</Text>
        <Text>{seats} 人可同行</Text>
      </View>
    </View>
  )
}
