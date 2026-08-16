import Taro from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import type { ErrandView } from '../../../api/types'
import UserAvatarImage from '../../../components/user-avatar-image'
import StickerContent from '../../../components/sticker-content'
import { apiDateTimeTimestamp } from '../../../utils/date-time'
import { requestWechatSubscriptionForModule } from '../../wechat-subscription'
import BusinessRoute from './business-route'
import { campusLabel } from '../campus'
import { saveBusinessDetailSnapshot } from '../business-detail-snapshot'
import {
  formatMoney,
  formatStatus,
  relativeDeadline,
} from '../format'

const openDetail = (item: ErrandView) => {
  requestWechatSubscriptionForModule('errand')
  saveBusinessDetailSnapshot('errand', item)
  Taro.navigateTo({ url: `/packages/social/errands/detail?id=${item.id}&snapshot=1` })
}

const isUrgent = (deadline?: string | null) => {
  if (!deadline) return false
  const timestamp = apiDateTimeTimestamp(deadline)
  const remaining = timestamp - Date.now()
  return remaining > 0 && remaining <= 6 * 60 * 60 * 1000
}

export default function ErrandCard({ item }: { item: ErrandView }) {
  const urgent = isUrgent(item.deadline)
  const authorName = item.author_nickname?.trim() || `发布者 #${item.requester_id}`
  const authorInitial = authorName.slice(0, 1) || '同'

  return (
    <View
      id={`errand-card-${item.id}`}
      className='errand-card'
      hoverClass='business-card--pressed'
      onClick={() => openDetail(item)}
    >
      <View className='business-card-header'>
        <View className='business-card-avatar business-card-avatar--errand'>
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
            <Text className='business-status business-status--errand'>
              {formatStatus(item.status, item.review_status)}
            </Text>
          </View>
          <Text>{relativeDeadline(item.deadline)}</Text>
        </View>
        <Text className='business-card-more'>•••</Text>
      </View>

      <StickerContent
        content={item.description}
        className='errand-card__title'
        stickerClassName='business-card__sticker'
      />
      <BusinessRoute
        startLabel='取件地'
        start={item.pickup_location}
        endLabel='送达地'
        end={item.dropoff_location}
      />
      <View className='errand-card__footer'>
        <View className='business-card-campus'>
          <Text>{campusLabel(item.campus)}</Text>
          <Text className={urgent ? 'errand-deadline errand-deadline--urgent' : 'errand-deadline'}>
            {relativeDeadline(item.deadline)}
          </Text>
        </View>
        <Text className='errand-card__reward'>赏金 {formatMoney(item.reward_cents)}</Text>
      </View>
    </View>
  )
}
