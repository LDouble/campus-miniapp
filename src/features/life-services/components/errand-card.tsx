import Taro from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import type { ErrandView } from '../../../api/types'
import { apiDateTimeTimestamp } from '../../../utils/date-time'
import { requestWechatSubscriptionForModule } from '../../wechat-subscription'
import {
  formatMoney,
  formatStatus,
  relativeDeadline,
} from '../format'

const openDetail = (id: number) => {
  requestWechatSubscriptionForModule('errand')
  Taro.navigateTo({ url: `/pages/errands/detail?id=${id}` })
}

const isUrgent = (deadline?: string | null) => {
  if (!deadline) return false
  const timestamp = apiDateTimeTimestamp(deadline)
  const remaining = timestamp - Date.now()
  return remaining > 0 && remaining <= 6 * 60 * 60 * 1000
}

export default function ErrandCard({ item }: { item: ErrandView }) {
  const urgent = isUrgent(item.deadline)

  return (
    <View
      id={`errand-card-${item.id}`}
      className='errand-card'
      hoverClass='business-card--pressed'
      onClick={() => openDetail(item.id)}
    >
      <View className='errand-card__top'>
        <View>
          <Text className='errand-card__label'>任务报酬</Text>
          <Text className='errand-card__reward'>{formatMoney(item.reward_cents)}</Text>
        </View>
        <Text className='business-status business-status--errand'>
          {formatStatus(item.status, item.review_status)}
        </Text>
      </View>

      <View className='errand-route'>
        <View className='errand-route__point errand-route__point--pickup'>取</View>
        <Text>{item.pickup_location}</Text>
        <View className='errand-route__line' />
        <View className='errand-route__point errand-route__point--dropoff'>送</View>
        <Text>{item.dropoff_location}</Text>
      </View>
      <Text className='errand-card__description'>{item.description}</Text>

      <View className='errand-card__footer'>
        <Text className={urgent ? 'errand-deadline errand-deadline--urgent' : 'errand-deadline'}>
          {relativeDeadline(item.deadline)}
        </Text>
        <View className='business-card-link'>
          <Text>查看任务</Text>
          <Text>›</Text>
        </View>
      </View>
    </View>
  )
}
