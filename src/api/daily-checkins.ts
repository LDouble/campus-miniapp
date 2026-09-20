import { apiRequest } from './client'
import type {
  DailyCheckinHistory,
  DailyCheckinResult,
  DailyCheckinStatus,
} from './types'
import { invalidateClientBootstrap } from './client-bootstrap'
import { createSharedResource } from '../state/shared-resource'

const dailyCheckinResource = createSharedResource<DailyCheckinStatus>({
  maxAgeMs: 30_000,
  group: 'session',
})

export const getMyDailyCheckinStatus = (options: { force?: boolean } = {}) => (
  dailyCheckinResource.ensure(
    () => apiRequest<DailyCheckinStatus>({ path: '/api/v1/checkins/me/status' }),
    options,
  )
)

export const seedMyDailyCheckinStatus = (status: DailyCheckinStatus) => (
  dailyCheckinResource.seed(status)
)

export const createDailyCheckin = async () => {
  const result = await apiRequest<DailyCheckinResult>({
    path: '/api/v1/checkins',
    method: 'POST',
  })
  dailyCheckinResource.invalidate({ clearData: true })
  invalidateClientBootstrap()
  return result
}

export const listMyDailyCheckinHistory = (month?: string) => (
  apiRequest<DailyCheckinHistory>({
    path: '/api/v1/checkins/me/history',
    query: { month },
  })
)
