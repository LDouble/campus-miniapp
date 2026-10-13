import Taro from '@tarojs/taro'
import type { ActivityPopupCandidate, ActivityPopupClaim } from '../../api/activity-popups'

export const ACTIVITY_POPUP_IDLE_MS = 1000

export const isActivityPopupCandidateValid = (
  candidate: ActivityPopupCandidate | null,
) => Boolean(
  candidate
    && Number.isInteger(candidate.id)
    && candidate.id > 0
    && typeof candidate.image_url === 'string'
    && /^https:\/\//.test(candidate.image_url)
    && candidate.action
    && (candidate.action.type === 'internal_page' || candidate.action.type === 'mini_program')
    && typeof candidate.action.target_key === 'string'
    && candidate.action.target_key.length > 0,
)

export const preloadActivityPopupImage = async (imageUrl: string) => {
  await Taro.getImageInfo({ src: imageUrl })
}

export const isActivityPopupClaimUsable = (
  claim: ActivityPopupClaim,
  now = Date.now(),
) => {
  const expiresAt = Date.parse(claim.lease_expires_at)
  return typeof claim.display_id === 'string'
    && claim.display_id.length > 0
    && Number.isFinite(expiresAt)
    && expiresAt > now
}

/**
 * 后端 close 事件会把展示升级为已确认；图片没有真正呈现或确认失败时，
 * 必须让预占租约自然过期，不能以 close 释放。
 */
export const shouldReportActivityPopupClose = (
  imagePresented: boolean,
  serverConfirmed: boolean,
) => imagePresented && serverConfirmed
