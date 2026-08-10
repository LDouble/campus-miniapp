import { apiRequest } from '../../api/client'
import type {
  OfficialNotice,
  OfficialNoticeCategory,
  OfficialNoticeFeed,
  OfficialNoticePage,
  OfficialNoticeSource,
} from './types'

export type OfficialNoticeQuery = {
  keyword?: string
  source?: OfficialNoticeSource
  category?: OfficialNoticeCategory
  publishedSince?: string
  page?: number
  pageSize?: number
}

export type OfficialNoticeFeedQuery = Omit<OfficialNoticeQuery, 'page'> & {
  cursor?: string
}

export const officialNoticesRepository = {
  list(query: OfficialNoticeQuery = {}) {
    return apiRequest<OfficialNoticePage>({
      path: '/api/v1/official-notices',
      skipAcademicVerificationGuard: true,
      query: {
        keyword: query.keyword,
        source: query.source,
        category: query.category,
        published_since: query.publishedSince,
        page: query.page || 1,
        page_size: query.pageSize || 20,
      },
    })
  },

  feed(query: OfficialNoticeFeedQuery = {}) {
    return apiRequest<OfficialNoticeFeed>({
      path: '/api/v1/official-notices/feed',
      skipAcademicVerificationGuard: true,
      query: {
        keyword: query.keyword,
        source: query.source,
        category: query.category,
        published_since: query.publishedSince,
        cursor: query.cursor,
        page_size: query.pageSize || 20,
      },
    })
  },

  get(id: number) {
    return apiRequest<OfficialNotice>({
      path: `/api/v1/official-notices/${id}`,
      skipAcademicVerificationGuard: true,
    })
  },
}
