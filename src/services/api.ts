import Taro from '@tarojs/taro'
import {
  getAcademicVerification,
  getActivity,
  getCampusCirclePost,
  getCarpoolTrip,
  getErrand,
  getMarketplaceListing,
  listActivities,
  listCampusCirclePosts,
  listCarpoolTrips,
  listErrands,
  listMarketplaceListings,
  verifyAcademicCredentials,
  wechatLogin
} from '../api/generated/client'
import type { ActivityView, CampusCirclePostView, CarpoolTripView, ErrandView, MarketplaceListingView, TokenPair } from '../api/generated/models'

export type ContentType = 'activity' | 'marketplace' | 'errand' | 'carpool' | 'campus-circle'
export interface FeedItem { id: number; type: ContentType; title: string; summary: string; status?: string; review_status?: string; available_actions?: string[]; updated_at?: string }
export interface AcademicStatus { identity: unknown; latest_request: { status?: string; review_reason?: string } | null }

const unwrap = <T>(response: { data: T }): T => response.data
const mapItem = (type: ContentType, item: ActivityView | MarketplaceListingView | ErrandView | CarpoolTripView | CampusCirclePostView): FeedItem => {
  const row = item as unknown as Record<string, unknown>
  return { id: Number(row.id), type, title: String(row.title || row.destination || '未命名内容'), summary: String(row.summary || row.description || row.content || ''), status: String(row.status || ''), review_status: String(row.review_status || ''), available_actions: Array.isArray(row.available_actions) ? row.available_actions.map(String) : [], updated_at: row.updated_at ? String(row.updated_at) : undefined }
}

export async function login(): Promise<TokenPair> {
  const { code } = await Taro.login()
  if (!code) throw new Error('微信登录失败，请重试')
  const result = unwrap(await wechatLogin({ app_id: 'touristappid', code }))
  Taro.setStorageSync('access_token', result.data.access_token)
  Taro.setStorageSync('refresh_token', result.data.refresh_token)
  return result.data
}

export async function getAcademicStatus(): Promise<AcademicStatus> {
  return unwrap(await getAcademicVerification()) as AcademicStatus
}

export async function verifyCredentials(studentNo: string, password: string): Promise<unknown> {
  return unwrap(await verifyAcademicCredentials({ student_no: studentNo, password }))
}

export async function getFeed(): Promise<FeedItem[]> {
  const pages = await Promise.all([
    listActivities({ page: 1, page_size: 10 }).then(response => unwrap(response).data.items.map(item => mapItem('activity', item))),
    listMarketplaceListings({ page: 1, page_size: 10 }).then(response => unwrap(response).data.items.map(item => mapItem('marketplace', item))),
    listErrands({ page: 1, page_size: 10 }).then(response => unwrap(response).data.items.map(item => mapItem('errand', item))),
    listCarpoolTrips({ page: 1, page_size: 10 }).then(response => unwrap(response).data.items.map(item => mapItem('carpool', item))),
    listCampusCirclePosts({ page: 1, page_size: 10 }).then(response => unwrap(response).data.items.map(item => mapItem('campus-circle', item)))
  ])
  return pages.flat().sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
}

export async function getDetail(type: ContentType, id: number): Promise<FeedItem> {
  if (type === 'activity') return mapItem(type, unwrap(await getActivity(id)).data)
  if (type === 'marketplace') return mapItem(type, unwrap(await getMarketplaceListing(id)).data)
  if (type === 'errand') return mapItem(type, unwrap(await getErrand(id)).data)
  if (type === 'carpool') return mapItem(type, unwrap(await getCarpoolTrip(id)).data)
  return mapItem(type, unwrap(await getCampusCirclePost(id)).data)
}
