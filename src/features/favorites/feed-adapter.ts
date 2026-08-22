import type { FavoriteItem, FavoriteResourceType, HomeFeedItemView } from '../../api/types'

const sourceTypeMap: Record<FavoriteResourceType, HomeFeedItemView['source_type']> = {
  campus_circle_post: 'campus_circle_post',
  marketplace: 'marketplace_listing',
  errand: 'errand',
  carpool: 'carpool',
}

const amountCents = (item: FavoriteItem) => {
  if (!item.preview) return null
  if (item.resource_type === 'marketplace') return item.preview.price_cents ?? null
  if (item.resource_type === 'errand') return item.preview.reward_cents ?? null
  return null
}

const availableSeats = (item: FavoriteItem) => {
  const totalSeats = item.preview?.total_seats
  const occupiedSeats = item.preview?.occupied_seats
  if (typeof totalSeats !== 'number' || typeof occupiedSeats !== 'number') return null
  return Math.max(0, totalSeats - occupiedSeats)
}

const favoriteContent = (item: FavoriteItem) => {
  const preview = item.preview
  if (!preview) return null
  const content = [preview.title, preview.summary]
    .map((value) => value?.trim() || '')
    .filter(Boolean)
  return content.length > 0 ? content.join('\n') : null
}

export const favoriteItemToHomeFeedItem = (item: FavoriteItem): HomeFeedItemView | null => {
  const preview = item.preview
  if (item.availability !== 'available' || !preview) return null

  const feedTime = preview.published_at || preview.created_at || item.favorited_at
  return {
    amount_cents: amountCents(item),
    author_avatar_url: preview.author_avatar_url,
    author_deleted: false,
    author_id: preview.author_id,
    author_nickname: preview.author_nickname,
    available_seats: availableSeats(item),
    campus: preview.campus,
    category: preview.category,
    comment_count: 0,
    comment_previews: [],
    content: favoriteContent(item),
    currency: preview.currency,
    deadline: preview.deadline,
    departure_at: preview.departure_at,
    destination: preview.destination,
    dropoff_location: preview.dropoff_location,
    feed_time: feedTime,
    images: preview.images.map((image) => ({
      media_id: image.media_id,
      url: image.url,
    })),
    intent: preview.intent,
    like_count: 0,
    liked: false,
    liked_by_nicknames: [],
    origin: preview.origin,
    pickup_location: preview.pickup_location,
    section_id: null,
    source_id: item.resource_id,
    source_type: sourceTypeMap[item.resource_type],
    total_seats: preview.total_seats,
    version: 1,
  }
}
