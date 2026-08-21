import Taro from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import type { CarpoolTripView } from '../../../api/types'
import UserAvatar from '../../../components/user-avatar'
import StickerContent from '../../../components/sticker-content'
import { requestWechatSubscriptionForModule } from '../../wechat-subscription'
import BusinessRoute from './business-route'
import { campusLabel } from '../campus'
import { saveBusinessDetailSnapshot } from '../business-detail-snapshot'
import {
  formatDateTime,
  formatStatus,
  remainingSeats,
} from '../format'

const openDetail = (item: CarpoolTripView) => {
  requestWechatSubscriptionForModule('carpool')
  saveBusinessDetailSnapshot('carpool', item)
  Taro.navigateTo({ url: `/packages/social/carpool/detail?id=${item.id}&snapshot=1` })
}

const timeParts = (value: string) => {
  const formatted = formatDateTime(value)
  const parts = formatted.split(' ')
  return {
    date: parts[0] || formatted,
    time: parts.slice(1).join(' ') || '待确认',
  }
}

export default function CarpoolCard({ item }: { item: CarpoolTripView }) {
  const seats = remainingSeats(item.total_seats, item.occupied_seats)
  const departure = timeParts(item.departure_at)
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
          <Text>{departure.date} {departure.time}</Text>
        </View>
        <Text className='business-card-more'>•••</Text>
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
        <Text>{campusLabel(item.campus)} · {departure.date} {departure.time}</Text>
        <Text>{seats} 人可同行</Text>
      </View>
    </View>
  )
}
