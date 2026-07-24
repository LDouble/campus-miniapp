import Taro from '@tarojs/taro'
import { get, post } from './request'

export type ContentType = 'activity' | 'marketplace' | 'errand' | 'carpool' | 'campus-circle'

export interface FeedItem {
  id: number
  type: ContentType
  title: string
  summary: string
  status?: string
  review_status?: string
  available_actions?: string[]
  updated_at?: string
}

export interface Page<T> { items: T[]; page: number; page_size: number; total: number }
export interface AcademicStatus { identity: unknown; latest_request: { status?: string; review_reason?: string } | null }
export interface TokenPair { access_token: string; refresh_token: string; token_type: string; expires_in: number }

const feedEndpoints: Record<ContentType, string> = {
  activity: '/api/v1/activities?page=1&page_size=10',
  marketplace: '/api/v1/marketplace/listings?page=1&page_size=10',
  errand: '/api/v1/errands?page=1&page_size=10',
  carpool: '/api/v1/carpool/trips?page=1&page_size=10',
  'campus-circle': '/api/v1/campus-circle/posts?page=1&page_size=10'
}

export async function login(): Promise<TokenPair> {
  const { code } = await Taro.login()
  if (!code) throw new Error('微信登录失败，请重试')
  const result = await post<TokenPair>('/api/v1/auth/wechat/login', { app_id: 'touristappid', code }, `wechat-login-${Date.now()}`)
  Taro.setStorageSync('access_token', result.access_token)
  Taro.setStorageSync('refresh_token', result.refresh_token)
  return result
}

export function getAcademicStatus(): Promise<AcademicStatus> {
  return get<AcademicStatus>('/api/v1/academic-verification')
}

export async function getFeed(): Promise<FeedItem[]> {
  const entries = await Promise.all(Object.entries(feedEndpoints).map(async ([type, endpoint]) => {
    try {
      const page = await get<Page<Record<string, unknown>>>(endpoint)
      return page.items.map((item) => ({
        id: Number(item.id), type: type as ContentType,
        title: String(item.title || item.destination || '未命名内容'),
        summary: String(item.summary || item.description || item.content || ''),
        status: String(item.status || ''), review_status: String(item.review_status || ''),
        available_actions: Array.isArray(item.available_actions) ? item.available_actions.map(String) : [],
        updated_at: item.updated_at ? String(item.updated_at) : undefined
      }))
    } catch (_) { return [] }
  }))
  return entries.flat().sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
}

export function getDetail(type: ContentType, id: number): Promise<FeedItem> {
  const path = type === 'activity' ? `/api/v1/activities/${id}`
    : type === 'marketplace' ? `/api/v1/marketplace/listings/${id}`
      : type === 'errand' ? `/api/v1/errands/${id}`
        : type === 'carpool' ? `/api/v1/carpool/trips/${id}`
          : `/api/v1/campus-circle/posts/${id}`
  return get<FeedItem>(path)
}
