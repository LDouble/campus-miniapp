import type { MediaView } from '../../api/media'

export type AvatarModerationOutcome = 'reviewing' | 'approved' | 'rejected'
export type ApprovedAvatarRefreshResolution = 'commit' | 'retry' | 'ignore'

type SyncStorage = {
  getStorageSync<T>(key: string): T
  setStorageSync<T>(key: string, value: T): void
  removeStorageSync(key: string): void
}

export const AVATAR_MODERATION_MAX_POLLS = 24
export const AVATAR_MODERATION_MAX_NETWORK_FAILURES = 4

const AVATAR_MODERATION_POLL_INTERVAL_MS = 2_000
const AVATAR_MODERATION_MAX_BACKOFF_MS = 12_000
const AVATAR_MODERATION_STORAGE_KEY_PREFIX = 'campus.profile.avatarModeration.v1.'

export const isAvatarModerationUserId = (userId: unknown): userId is number => (
  Number.isSafeInteger(userId) && Number(userId) > 0
)

const isAvatarModerationMediaId = (mediaId: unknown): mediaId is number => (
  Number.isSafeInteger(mediaId) && Number(mediaId) > 0
)

const storageKey = (userId: number) => `${AVATAR_MODERATION_STORAGE_KEY_PREFIX}${userId}`

export const avatarModerationStorage = {
  read(storage: SyncStorage, userId: number) {
    if (!isAvatarModerationUserId(userId)) return null
    try {
      const stored = storage.getStorageSync<unknown>(storageKey(userId))
      return isAvatarModerationMediaId(stored) ? stored : null
    } catch {
      return null
    }
  },
  write(storage: SyncStorage, userId: number, mediaId: number) {
    if (!isAvatarModerationUserId(userId) || !isAvatarModerationMediaId(mediaId)) {
      return false
    }
    try {
      storage.setStorageSync(storageKey(userId), mediaId)
      return true
    } catch {
      return false
    }
  },
  remove(storage: SyncStorage, userId: number) {
    if (!isAvatarModerationUserId(userId)) return false
    try {
      storage.removeStorageSync(storageKey(userId))
      return true
    } catch {
      return false
    }
  },
}

export const resolveAvatarModerationOutcome = (
  status: MediaView['moderation_status'],
): AvatarModerationOutcome => {
  switch (status) {
    case 'passed':
    case 'manual_approved':
      return 'approved'
    case 'rejected':
    case 'manual_rejected':
    case 'error':
      return 'rejected'
    case 'pending':
    case 'checking':
    case 'manual_review':
      return 'reviewing'
  }
}

export const avatarModerationPollDelay = (networkFailureCount: number) => (
  Math.min(
    AVATAR_MODERATION_POLL_INTERVAL_MS * (2 ** Math.max(0, networkFailureCount)),
    AVATAR_MODERATION_MAX_BACKOFF_MS,
  )
)

export const canRetryApprovedAvatarRefresh = (
  refreshFailureCount: number,
  pollCount: number,
) => (
  refreshFailureCount < AVATAR_MODERATION_MAX_NETWORK_FAILURES
  && pollCount < AVATAR_MODERATION_MAX_POLLS
)

export const resolveApprovedAvatarRefresh = (
  refreshed: boolean,
  operationCurrent: boolean,
): ApprovedAvatarRefreshResolution => {
  if (!operationCurrent) return 'ignore'
  return refreshed ? 'commit' : 'retry'
}
