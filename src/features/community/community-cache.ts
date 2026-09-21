import type {
  CampusCirclePostView,
  CampusCircleSectionView,
  CampusCircleTopicView,
} from '../../api/types'
import { getMiniappRuntimeConfig, getSelectedCampus } from '../runtime-config'
import { getPageCacheScope } from '../../state/page-cache'

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
)

const isPost = (value: unknown): value is CampusCirclePostView => (
  isRecord(value)
  && typeof value.id === 'number'
  && typeof value.section_id === 'number'
  && typeof value.version === 'number'
  && typeof value.author_id === 'number'
  && typeof value.author_nickname === 'string'
  && typeof value.author_deleted === 'boolean'
  && isRecord(value.author_level)
  && typeof value.created_at === 'string'
  && typeof value.updated_at === 'string'
  && (typeof value.content === 'string' || value.content === null)
  && typeof value.comment_count === 'number'
  && typeof value.like_count === 'number'
  && typeof value.liked === 'boolean'
  && Array.isArray(value.images)
  && value.images.every((image) => isRecord(image)
    && typeof image.id === 'number' && typeof image.url === 'string')
  && Array.isArray(value.comment_previews)
  && value.comment_previews.every((comment) => isRecord(comment)
    && typeof comment.id === 'number' && typeof comment.author_id === 'number'
    && typeof comment.author_nickname === 'string' && typeof comment.content === 'string'
    && typeof comment.root_id === 'number')
  && Array.isArray(value.liked_by_nicknames)
  && value.liked_by_nicknames.every((name) => typeof name === 'string')
  && Array.isArray(value.available_actions)
)

const isSection = (value: unknown): value is CampusCircleSectionView => (
  isRecord(value)
  && typeof value.id === 'number'
  && typeof value.name === 'string'
  && (typeof value.parent_id === 'number' || value.parent_id === null)
  && typeof value.status === 'string'
  && Array.isArray(value.children)
  && value.children.every(isSection)
)

const isTopic = (value: unknown): value is CampusCircleTopicView => (
  isRecord(value)
  && typeof value.id === 'number'
  && typeof value.name === 'string'
  && typeof value.kind === 'string'
  && typeof value.post_count === 'number'
  && typeof value.is_hot === 'boolean'
)

export type CommunityFeedCacheEntry = {
  posts: CampusCirclePostView[]
  page: number
  total: number
}

export const isCommunitySectionsCache = (value: unknown): value is CampusCircleSectionView[] => (
  Array.isArray(value) && value.every(isSection)
)

export const isCommunityTopicsCache = (value: unknown): value is CampusCircleTopicView[] => (
  Array.isArray(value) && value.every(isTopic)
)

export const isCommunityFeedCache = (value: unknown): value is CommunityFeedCacheEntry => (
  isRecord(value)
  && Array.isArray(value.posts)
  && value.posts.every(isPost)
  && typeof value.page === 'number'
  && value.page >= 1
  && typeof value.total === 'number'
  && value.total >= 0
)

export const communityCacheKey = (suffix: string) => {
  const campus = getSelectedCampus(getMiniappRuntimeConfig()) || 'all'
  return `${getPageCacheScope()}:community:${campus}:${suffix}`
}
