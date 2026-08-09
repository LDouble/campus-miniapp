import { apiRequest } from './client'
import type {
  DailyCheckinHistory,
  DailyCheckinResult,
  DailyCheckinStatus,
} from './types'

export const getMyDailyCheckinStatus = () => apiRequest<DailyCheckinStatus>({
  path: '/api/v1/checkins/me/status',
})

export const createDailyCheckin = () => apiRequest<DailyCheckinResult>({
  path: '/api/v1/checkins',
  method: 'POST',
})

export const listMyDailyCheckinHistory = (month?: string) => (
  apiRequest<DailyCheckinHistory>({
    path: '/api/v1/checkins/me/history',
    query: { month },
  })
)
