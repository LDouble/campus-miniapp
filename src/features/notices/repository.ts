import { apiRequest } from '../../api/client'
import type { Notice, NoticePage } from '../../api/types'

export type NoticeQuery = {
  page?: number
  pageSize?: number
  unread?: boolean
  category?: string
}

export const noticesRepository = {
  list(query: NoticeQuery = {}) {
    return apiRequest<NoticePage>({
      path: '/api/v1/notices',
      query: {
        page: query.page || 1,
        page_size: query.pageSize || 30,
        unread: query.unread,
        category: query.category,
      },
    })
  },

  get(id: number) {
    return apiRequest<Notice>({ path: `/api/v1/notices/${id}` })
  },

  unreadCount() {
    return apiRequest<{ count: number }>({
      path: '/api/v1/notices/unread-count',
    })
  },

  read(id: number) {
    return apiRequest<{ read: boolean }>({
      path: `/api/v1/notices/${id}/read`,
      method: 'PUT',
    })
  },

  readAll() {
    return apiRequest<{ updated: number }>({
      path: '/api/v1/notices/read-all',
      method: 'PUT',
    })
  },
}
