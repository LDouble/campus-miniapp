import { apiRequest } from './client'
import type {
  UserExperienceLedgerPage,
  UserLevelSummary,
} from './types'

export const getMyUserLevel = () => apiRequest<UserLevelSummary>({
  path: '/api/v1/user-levels/me',
})

export const listMyUserExperienceLedger = (page = 1, pageSize = 20) => (
  apiRequest<UserExperienceLedgerPage>({
    path: '/api/v1/user-levels/me/ledger',
    query: { page, page_size: pageSize },
  })
)
