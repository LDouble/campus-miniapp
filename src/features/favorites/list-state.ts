import type { FavoriteItem } from '../../api/types'

export const favoriteListItemKey = (
  item: Pick<FavoriteItem, 'resource_type' | 'resource_id'>,
) => `${item.resource_type}:${item.resource_id}`

export const mergeFavoriteItems = (current: FavoriteItem[], incoming: FavoriteItem[]) => {
  const seen = new Set<string>()
  return [...current, ...incoming].filter((item) => {
    const key = favoriteListItemKey(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export const hasMoreFavoriteItems = (loadedCount: number, total: number) => loadedCount < total
