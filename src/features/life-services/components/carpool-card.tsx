import Taro from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import type { CarpoolTripView } from '../../../api/types'
import UserAvatarImage from '../../../components/user-avatar-image'
import { requestWechatSubscriptionForModule } from '../../wechat-subscription'
import BusinessRoute from './business-route'
import {
  formatDateTime,
  formatStatus,
  remainingSeats,
} from '../format'

const openDetail = (id: number) => {
  requestWechatSubscriptionForModule('carpool')
  Taro.navigateTo({ url: `/pages/carpool/detail?id=${id}` })
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
      hoverClass='business-card--pressed'
      onClick={() => openDetail(item.id)}
    >
      <View className='business-card-header'>
        <View className='business-card-avatar business-card-avatar--carpool'>
          <UserAvatarImage
            src={item.author_avatar_url}
            className='business-card-avatar__image'
            fallback={authorInitial}
            lazyLoad
          />
        </View>
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

      {item.description && <Text className='carpool-card__description'>{item.description}</Text>}
      <BusinessRoute
        startLabel='出发地'
        start={item.origin}
        endLabel='目的地'
        end={item.destination}
      />

      <View className='carpool-card__footer'>
        <Text>出发时间：{departure.date} {departure.time}</Text>
        <Text>{seats} 人可同行</Text>
      </View>
    </View>
  )
}
