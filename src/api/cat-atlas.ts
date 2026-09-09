import { apiRequest, createIdempotencyKey } from './client'

// 该模块在 OpenAPI 客户端同步前提供临时的强类型边界；字段与 cat_atlas.yaml 保持一致。
export type CatView = {
  id: number
  name: string
  campus: string
  aliases: string[]
  gender: string
  coat: string
  traits: string[]
  resident_area: string
  first_recorded_at: string
  cover_url?: string | null
  sighting_count: number
  last_seen_at?: string | null
  favorited: boolean
}

export type SightingView = {
  id: number
  cat_id: number
  cat_name: string
  cat_cover_url?: string | null
  reporter_name: string
  reporter_avatar_url?: string | null
  area: string
  activity: string
  note?: string | null
  photo_url?: string | null
  like_count: number
  liked: boolean
  created_at: string
}

export type CatPage = { items: CatView[]; page: number; page_size: number; total: number }
export type SightingPage = { items: SightingView[]; page: number; page_size: number; total: number }
export type CatCatalog = { seen_count: number; total_count: number; seen_cats: CatView[]; unseen_cats: CatView[] }
export type CatHotspot = { area: string; sighting_count: number; last_seen_at: string }

export type CatSort = 'newest' | 'latest_seen' | 'popular'

export const listCats = (input: { keyword?: string; area?: string; sort?: CatSort; page?: number; pageSize?: number } = {}) => apiRequest<CatPage>({
  path: '/api/v1/cats',
  query: { keyword: input.keyword, area: input.area, sort: input.sort, page: input.page || 1, page_size: input.pageSize || 30 },
})

export const getCat = (id: string | number) => apiRequest<CatView>({ path: `/api/v1/cats/${id}` })

export const listCatSightings = (id: string | number, page = 1) => apiRequest<SightingPage>({
  path: `/api/v1/cats/${id}/sightings`, query: { page, page_size: 30 },
})

export const listCatHotspots = (id: string | number, days = 7) => apiRequest<CatHotspot[]>({
  path: `/api/v1/cats/${id}/hotspots`, query: { days },
})

export const createCatSighting = (id: string | number, input: {
  area: string; activity: string; note?: string; photo_media_id?: number
}) => apiRequest<SightingPage>({
  path: `/api/v1/cats/${id}/sightings`, method: 'POST', data: input,
  idempotencyKey: createIdempotencyKey(`cat:${id}:sighting`),
})

export const getMyCatCatalog = () => apiRequest<CatCatalog>({ path: '/api/v1/me/cat-catalog' })

export const submitCat = (input: { proposed_name?: string; campus: string; area: string; description?: string; photo_media_id: number }) => apiRequest({
  path: '/api/v1/cat-submissions', method: 'POST', data: input,
  idempotencyKey: createIdempotencyKey('cat:submission'),
})

export const setCatFavorite = (id: string | number, favorited: boolean) => apiRequest<{ resource_type: 'cat'; resource_id: number; favorited: boolean }>({
  path: `/api/v1/favorites/${id}`,
  method: favorited ? 'PUT' : 'DELETE',
  query: { resource_type: 'cat' },
})

export const setSightingLiked = (id: string | number, liked: boolean) => apiRequest<{ resource_type: 'cat_sighting'; resource_id: number; like_count: number; liked: boolean }>({
  path: `/api/v1/likes/${id}`,
  method: liked ? 'PUT' : 'DELETE',
  query: { resource_type: 'cat_sighting' },
})
