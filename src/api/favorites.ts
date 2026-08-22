import { apiRequest } from './client'
import type {
  FavoritePage,
  FavoriteResourceType,
  FavoriteState,
} from './types'

export type FavoriteListQuery = {
  resourceType?: FavoriteResourceType
  page?: number
  pageSize?: number
}

const normalizePage = (value?: number) => (
  Number.isInteger(value) && value && value > 0 ? value : 1
)

const normalizePageSize = (value?: number) => (
  Number.isInteger(value) && value && value > 0 ? Math.min(value, 100) : 20
)

export const listMyFavorites = (query: FavoriteListQuery = {}) => apiRequest<FavoritePage>({
  path: '/api/v1/favorites',
  query: {
    resource_type: query.resourceType,
    page: normalizePage(query.page),
    page_size: normalizePageSize(query.pageSize),
  },
})

const favoriteRequest = (
  resourceId: number,
  resourceType: FavoriteResourceType,
  method: 'GET' | 'PUT' | 'DELETE',
) => apiRequest<FavoriteState>({
  path: `/api/v1/favorites/${resourceId}`,
  method,
  query: { resource_type: resourceType },
})

export const getFavoriteState = (
  resourceId: number,
  resourceType: FavoriteResourceType,
) => favoriteRequest(resourceId, resourceType, 'GET')

export const addFavorite = (
  resourceId: number,
  resourceType: FavoriteResourceType,
) => favoriteRequest(resourceId, resourceType, 'PUT')

export const removeFavorite = (
  resourceId: number,
  resourceType: FavoriteResourceType,
) => favoriteRequest(resourceId, resourceType, 'DELETE')
