import { apiRequest } from '../../api/client'
import type {
  OfficialNotice,
  OfficialNoticeCategory,
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

  get(id: number) {
    return apiRequest<OfficialNotice>({
      path: `/api/v1/official-notices/${id}`,
      skipAcademicVerificationGuard: true,
    })
  },
}
