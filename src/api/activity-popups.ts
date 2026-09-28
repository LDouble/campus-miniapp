import { apiRequest, createIdempotencyKey } from './client'
import type { components } from './generated/schema'

export type ActivityPopupAction = components['schemas']['ActivityPopupAction']
export type ActivityPopupCandidate = components['schemas']['ActivityPopupCandidateView']
export type ActivityPopupClaim = components['schemas']['ActivityPopupClaim']
type ActivityPopupCandidateEnvelope = components['schemas']['ActivityPopupCandidate']

export const getActivityPopupCandidate = async () => {
  const result = await apiRequest<ActivityPopupCandidateEnvelope>({
    path: '/api/v1/activity-popups/candidate',
  })
  return result.activity || null
}

export const claimActivityPopup = (activityId: number) => apiRequest<ActivityPopupClaim>({
  path: `/api/v1/activity-popups/${encodeURIComponent(activityId)}/claim`,
  method: 'POST',
  idempotencyKey: createIdempotencyKey(`activity-popup:${activityId}:claim`),
})

const reportActivityPopupDisplayEvent = (
  displayId: string,
  event: 'confirm' | 'close' | 'click',
) => apiRequest<void>({
  path: `/api/v1/activity-popups/displays/${encodeURIComponent(displayId)}/${event}`,
  method: 'POST',
  idempotencyKey: createIdempotencyKey(`activity-popup:${displayId}:${event}`),
})

export const confirmActivityPopupDisplay = (displayId: string) => (
  reportActivityPopupDisplayEvent(displayId, 'confirm')
)

export const closeActivityPopupDisplay = (displayId: string) => (
  reportActivityPopupDisplayEvent(displayId, 'close')
)

export const clickActivityPopupDisplay = (displayId: string) => (
  reportActivityPopupDisplayEvent(displayId, 'click')
)
