import type { FavoriteItem } from '../../api/types'

export const favoriteResourceKey = (
  item: Pick<FavoriteItem, 'resource_id' | 'resource_type'>,
) => `${item.resource_type}:${item.resource_id}`

export const favoriteDetailURL = (item: Pick<FavoriteItem, 'resource_id' | 'resource_type'>) => {
  const id = item.resource_id
  switch (item.resource_type) {
    case 'campus_circle_post':
      return `/packages/social/community/detail?id=${id}&mode=post`
    case 'marketplace':
      return `/packages/social/marketplace/detail?id=${id}`
    case 'errand':
      return `/packages/social/errands/detail?id=${id}`
    case 'carpool':
      return `/packages/social/carpool/detail?id=${id}`
    default:
      return ''
  }
}
