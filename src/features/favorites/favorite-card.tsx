import { Text, View } from '@tarojs/components'
import type { FavoriteItem } from '../../api/types'
import CommunityPostCard from '../community/post-card'
import { homeFeedBusinessPreview, homeFeedItemToPost } from '../home/feed-post-adapter'
import FavoriteToggle from './favorite-toggle'
import { favoriteItemToHomeFeedItem } from './feed-adapter'
import {
  favoriteResourceClassNames,
  favoriteResourceLabels,
  openFavoriteDetail,
} from './types'
import { formatDateTime } from '../life-services/format'
import './favorite-card.scss'

type FavoriteCardProps = {
  item: FavoriteItem
  onRemoved: (item: FavoriteItem) => void
  motionDelay?: number
}

const FavoriteToggleAction = ({ item, onRemoved }: FavoriteCardProps) => (
  <FavoriteToggle
    resourceId={item.resource_id}
    resourceType={item.resource_type}
    initialFavorited
    loadState={false}
    compact
    onChange={(favorited) => {
      if (!favorited) onRemoved(item)
    }}
  />
)

const FavoriteUnavailableCard = ({ item, onRemoved }: FavoriteCardProps) => (
  <View className='favorite-unavailable-card'>
    <View className='favorite-unavailable-card__header'>
      <View className='favorite-unavailable-card__label'>
        <View className={`favorite-unavailable-card__dot favorite-unavailable-card__dot--${favoriteResourceClassNames[item.resource_type]}`} />
        <Text>{favoriteResourceLabels[item.resource_type]}</Text>
      </View>
      <FavoriteToggleAction item={item} onRemoved={onRemoved} />
    </View>
    <Text className='favorite-unavailable-card__title'>内容已不可用</Text>
    <Text className='favorite-unavailable-card__summary'>原内容可能已删除、下架或暂时无法公开查看。</Text>
    <Text className='favorite-unavailable-card__time'>收藏于 {formatDateTime(item.favorited_at)}</Text>
  </View>
)

export default function FavoriteCard({ item, onRemoved, motionDelay }: FavoriteCardProps) {
  const feedItem = favoriteItemToHomeFeedItem(item)
  if (!feedItem) return <FavoriteUnavailableCard item={item} onRemoved={onRemoved} />

  const post = homeFeedItemToPost(feedItem)
  return (
    <CommunityPostCard
      post={post}
      instanceKey={`${item.resource_type}:${item.resource_id}`}
      motionDelay={motionDelay}
      variant={favoriteResourceClassNames[item.resource_type]}
      businessPreview={homeFeedBusinessPreview(feedItem) || undefined}
      sectionName={favoriteResourceLabels[item.resource_type]}
      timeFormatter={() => `收藏于 ${formatDateTime(item.favorited_at)}`}
      trailingAction={<FavoriteToggleAction item={item} onRemoved={onRemoved} />}
      onOpen={() => openFavoriteDetail(item)}
      ariaLabel={`查看${favoriteResourceLabels[item.resource_type]}详情`}
    />
  )
}
