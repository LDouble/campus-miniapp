import Taro from '@tarojs/taro'
import type {
  FavoriteItem,
  FavoriteResourcePreview,
  FavoriteResourceType,
} from '../../api/types'
import { favoriteDetailURL } from './links'

export { favoriteDetailURL, favoriteResourceKey } from './links'

export const favoriteResourceLabels: Record<FavoriteResourceType, string> = {
  campus_circle_post: '校园动态',
  marketplace: '二手',
  errand: '跑腿',
  carpool: '找同行',
}

export type FavoriteFeedVariant = 'community' | 'marketplace' | 'errand' | 'carpool'

export const favoriteResourceClassNames: Record<FavoriteResourceType, FavoriteFeedVariant> = {
  campus_circle_post: 'community',
  marketplace: 'marketplace',
  errand: 'errand',
  carpool: 'carpool',
}

export const favoritePreviewImage = (preview?: FavoriteResourcePreview) => (
  preview?.cover_url || preview?.images?.[0]?.url || ''
)

export const favoritePreviewTitle = (
  item: Pick<FavoriteItem, 'resource_type'> & { preview?: FavoriteResourcePreview },
) => {
  const preview = item.preview
  if (!preview) return '内容已不可用'
  if (preview.title) return preview.title
  switch (item.resource_type) {
    case 'carpool':
      if (preview.origin && preview.destination) return `${preview.origin} → ${preview.destination}`
      return '校园同行计划'
    case 'marketplace':
      return preview.intent === 'wanted' ? '校园求购' : '校园闲置'
    case 'errand':
      return '校园跑腿任务'
    default:
      return '校园动态'
  }
}

export const favoritePreviewSummary = (preview?: FavoriteResourcePreview) => (
  preview?.summary?.trim() || ''
)

export const openFavoriteDetail = (item: FavoriteItem) => {
  if (item.availability !== 'available' || !item.preview) {
    Taro.showToast({ title: '这条内容暂时不可查看', icon: 'none' })
    return
  }
  const url = favoriteDetailURL(item)
  if (url) void Taro.navigateTo({ url })
}
