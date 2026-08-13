import Taro from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import type { CarpoolTripView } from '../../../api/types'
import { requestWechatSubscriptionForModule } from '../../wechat-subscription'
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

  return (
    <View
      id={`carpool-card-${item.id}`}
      className='carpool-card'
      hoverClass='business-card--pressed'
      onClick={() => openDetail(item.id)}
    >
      <View className='carpool-card__top'>
        <View className='carpool-departure'>
          <Text>{departure.time}</Text>
          <Text>{departure.date} 出发</Text>
        </View>
        <View className='carpool-seat'>
          <Text>{seats}</Text>
          <Text>人可同行</Text>
        </View>
      </View>

      <View className='carpool-route'>
        <View className='carpool-route__place'>
          <Text>起点</Text>
          <Text>{item.origin}</Text>
        </View>
        <View className='carpool-route__track'>
          <View />
          <View />
          <View />
        </View>
        <View className='carpool-route__place carpool-route__place--destination'>
          <Text>终点</Text>
          <Text>{item.destination}</Text>
        </View>
      </View>

      {item.description && <Text className='carpool-card__description'>{item.description}</Text>}
      <View className='carpool-card__footer'>
        <Text>{formatStatus(item.status, item.review_status)}</Text>
        <Text>{item.occupied_seats}/{item.total_seats} 人已响应</Text>
        <Text>详情 ›</Text>
      </View>
    </View>
  )
}
