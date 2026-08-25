import type { CampusCirclePostView, HomeFeedItemView } from '../../api/types'
import { formatDateTime, formatMoney } from '../life-services/format'

const sourceLabels: Record<HomeFeedItemView['source_type'], string> = {
  campus_circle_post: '校园动态',
  marketplace_listing: '二手',
  errand: '跑腿',
  carpool: '找同行',
}

const deadlineLimit = (deadline?: string | null, startedAt?: string) => {
  if (!deadline) return ''
  const duration = new Date(deadline).getTime() - new Date(startedAt || '').getTime()
  if (Number.isFinite(duration) && duration > 0) {
    const minutes = Math.round(duration / 60_000)
    if (minutes < 60) return `限 ${minutes} 分钟`
    if (minutes < 24 * 60) return `限 ${Math.round(minutes / 60)} 小时`
  }
  return `截止 ${formatDateTime(deadline)}`
}

const homeFeedBusinessPreview = (item: HomeFeedItemView) => {
  if (item.source_type === 'marketplace_listing') {
    const intent = item.intent === 'wanted' ? '求购' : '闲置'
    const price = typeof item.amount_cents === 'number' ? formatMoney(item.amount_cents) : '价格面议'
    return { title: `二手 · ${intent}`, meta: [price, item.campus].filter(Boolean).join(' · ') }
  }
  if (item.source_type === 'errand') {
    const reward = typeof item.amount_cents === 'number' ? formatMoney(item.amount_cents) : '报酬面议'
    return {
      title: '跑腿 · 待接单',
      meta: [`报酬 ${reward}`, deadlineLimit(item.deadline, item.feed_time)].filter(Boolean).join(' · '),
    }
  }
  if (item.source_type === 'carpool') {
    const route = [item.origin, item.destination].filter(Boolean).join(' → ') || '校内找同行'
    const departure = item.departure_at ? formatDateTime(item.departure_at) : ''
    const seats = typeof item.available_seats === 'number' ? `余 ${item.available_seats} 座` : ''
    return { title: `找同行 · ${seats || '可同行'}`, meta: [route, departure].filter(Boolean).join(' · ') }
  }
  return null
}

const emptyAuthorLevel: CampusCirclePostView['author_level'] = {
  current_threshold: 0,
  experience: 0,
  is_max_level: false,
  level: 0,
  name: '',
  progress_percent: 0,
  theme: 'ocean',
}

const homeFeedItemToPost = (
  item: HomeFeedItemView,
  reaction?: { liked: boolean; likeCount: number; likedByNicknames: string[] },
): CampusCirclePostView => ({
  author_avatar_url: item.author_avatar_url ?? null,
  author_deleted: item.author_deleted,
  author_id: item.author_id,
  author_level: emptyAuthorLevel,
  author_nickname: item.author_nickname,
  available_actions: [],
  comment_count: item.comment_count,
  comment_previews: item.comment_previews,
  content: item.content || null,
  content_segments: item.content_segments,
  created_at: item.feed_time,
  id: item.source_id,
  images: item.images.map((image, index) => ({
    id: image.media_id || index + 1,
    media_id: image.media_id,
    sort_order: index,
    url: image.url,
  })),
  is_featured: false,
  is_pinned: false,
  is_recommended: false,
  like_count: reaction?.likeCount ?? item.like_count,
  liked: reaction?.liked ?? item.liked,
  liked_by_nicknames: reaction?.likedByNicknames ?? item.liked_by_nicknames,
  published_at: item.feed_time,
  review_reason: null,
  reviewed_at: null,
  reviewed_by: null,
  section_id: item.section_id || 0,
  status: 'approved',
  updated_at: item.feed_time,
  version: item.version,
  viewer_relation: 'other',
})

const homeFeedKey = (item: HomeFeedItemView) => `${item.source_type}-${item.source_id}`

export { homeFeedBusinessPreview, homeFeedItemToPost, homeFeedKey, sourceLabels }
