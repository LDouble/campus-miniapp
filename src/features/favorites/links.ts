import type { FavoriteItem } from '../../api/types'

export const favoriteResourceKey = (
  item: Pick<FavoriteItem, 'resource_id' | 'resource_type'>,
) => `${item.resource_type}:${item.resource_id}`

export const favoriteDetailURL = (item: Pick<FavoriteItem, 'resource_id' | 'resource_type'>) => {
  const id = item.resource_id
  switch (item.resource_type) {
    case 'campus_circle_post':
      return `/pages/community/detail?id=${id}&mode=post`
    case 'marketplace':
      return `/pages/marketplace/detail?id=${id}`
    case 'errand':
      return `/pages/errands/detail?id=${id}`
    case 'carpool':
      return `/pages/carpool/detail?id=${id}`
    default:
      return ''
  }
}
