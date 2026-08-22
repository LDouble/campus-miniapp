import { Image, Text, View } from '@tarojs/components'
import type { FavoriteItem, FavoriteResourcePreview } from '../../api/types'
import FavoriteToggle from './favorite-toggle'
import {
  favoritePreviewImage,
  favoritePreviewSummary,
  favoritePreviewTitle,
  favoriteResourceClassNames,
  favoriteResourceLabels,
  openFavoriteDetail,
} from './types'
import { formatDateTime, formatMoney, formatStatus } from '../life-services/format'
import { campusLabel } from '../life-services/campus'
import './favorite-card.scss'

type FavoriteCardProps = {
  item: FavoriteItem
  onRemoved: (item: FavoriteItem) => void
}

const previewHasValue = (value?: string | null) => Boolean(value?.trim())

const renderPreviewMeta = (item: FavoriteItem, preview: FavoriteResourcePreview) => {
  const meta: string[] = []
  if (preview.campus) meta.push(campusLabel(preview.campus))
  if (preview.status || preview.review_status) {
    meta.push(formatStatus(preview.status, preview.review_status || undefined))
  }
  if (item.resource_type === 'marketplace' && preview.price_cents !== null && preview.price_cents !== undefined) {
    meta.push(formatMoney(preview.price_cents))
  }
  if (item.resource_type === 'errand' && preview.reward_cents !== null && preview.reward_cents !== undefined) {
    meta.push(`赏金 ${formatMoney(preview.reward_cents)}`)
  }
  if (item.resource_type === 'carpool' && preview.departure_at) {
    meta.push(formatDateTime(preview.departure_at))
  }
  return meta
}

const renderPreviewRoute = (item: FavoriteItem, preview: FavoriteResourcePreview) => {
  if (item.resource_type === 'errand' && (preview.pickup_location || preview.dropoff_location)) {
    return (
      <View className='favorite-card__route'>
        <Text>{preview.pickup_location || '取件地点待补充'}</Text>
        <Text className='favorite-card__route-arrow'>→</Text>
        <Text>{preview.dropoff_location || '送达地点待补充'}</Text>
      </View>
    )
  }
  if (item.resource_type === 'carpool' && (preview.origin || preview.destination)) {
    return (
      <View className='favorite-card__route'>
        <Text>{preview.origin || '出发地待补充'}</Text>
        <Text className='favorite-card__route-arrow'>→</Text>
        <Text>{preview.destination || '目的地待补充'}</Text>
      </View>
    )
  }
  return null
}

export default function FavoriteCard({ item, onRemoved }: FavoriteCardProps) {
  const preview = item.preview
  const available = item.availability === 'available' && Boolean(preview)
  const className = `favorite-card favorite-card--${favoriteResourceClassNames[item.resource_type]} ${available ? '' : 'favorite-card--unavailable'}`
  const imageURL = favoritePreviewImage(preview)
  const meta = preview ? renderPreviewMeta(item, preview) : []

  return (
    <View
      className={className}
      ariaRole={available ? 'button' : undefined}
      ariaLabel={available ? `查看${favoriteResourceLabels[item.resource_type]}详情` : '内容已不可用'}
      onClick={() => {
        if (available) openFavoriteDetail(item)
      }}
    >
      <View className='favorite-card__body'>
        <View className='favorite-card__heading'>
          <View className='favorite-card__label'>
            <View className='favorite-card__dot' />
            <Text>{favoriteResourceLabels[item.resource_type]}</Text>
          </View>
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
        </View>

        {available && preview ? (
          <View className='favorite-card__content'>
            <View className='favorite-card__copy'>
              <Text className='favorite-card__title'>{favoritePreviewTitle(item)}</Text>
              {previewHasValue(favoritePreviewSummary(preview)) && (
                <Text className='favorite-card__summary'>{favoritePreviewSummary(preview)}</Text>
              )}
              {renderPreviewRoute(item, preview)}
              {meta.length > 0 && (
                <View className='favorite-card__meta'>
                  {meta.map((value) => <Text key={value}>{value}</Text>)}
                </View>
              )}
            </View>
            {imageURL ? (
              <Image className='favorite-card__cover' src={imageURL} mode='aspectFill' lazyLoad />
            ) : (
              <View className='favorite-card__cover favorite-card__cover--placeholder'>
                <Text>{favoriteResourceLabels[item.resource_type]}</Text>
              </View>
            )}
          </View>
        ) : (
          <View className='favorite-card__unavailable-copy'>
            <Text className='favorite-card__title'>内容已不可用</Text>
            <Text className='favorite-card__summary'>原内容可能已删除、下架或暂时无法公开查看。</Text>
          </View>
        )}
      </View>
      <View className='favorite-card__footer'>
        <Text>收藏于 {formatDateTime(item.favorited_at)}</Text>
        {available && <Text>点击查看详情</Text>}
      </View>
    </View>
  )
}
