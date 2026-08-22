import type { MediaView } from '../../api/media'

export const PRIVATE_MESSAGE_MEDIA_REVIEW_POLL_INTERVAL_MS = 1_500
export const PRIVATE_MESSAGE_MEDIA_REVIEW_MAX_ATTEMPTS = 20
export const PRIVATE_MESSAGE_MEDIA_REVIEW_MAX_BACKOFF_MS = 8_000

export type PrivateMessageMediaReviewResult = {
  kind: 'passed' | 'rejected' | 'timeout' | 'cancelled'
  media: MediaView | null
}

type PrivateMessageMediaReviewInput = MediaView | MediaView['moderation_status']

export const privateMessageMediaReviewState = (
  input: PrivateMessageMediaReviewInput,
) => {
  const moderationStatus = typeof input === 'string' ? input : input.moderation_status
  const mediaStatus = typeof input === 'string' ? '' : input.status
  if (mediaStatus === 'deleting' || mediaStatus === 'expired') return 'rejected'
  if (moderationStatus === 'passed' || moderationStatus === 'manual_approved') return 'passed'
  if (moderationStatus === 'rejected' || moderationStatus === 'error' || moderationStatus === 'manual_rejected') {
    return 'rejected'
  }
  return 'pending'
}

export const privateMessageMediaRetryAction = (
  input: PrivateMessageMediaReviewInput,
) => (
  (typeof input !== 'string' && (input.status === 'deleting' || input.status === 'expired'))
    || (typeof input === 'string' && (input === 'rejected' || input === 'manual_rejected'))
    || (typeof input !== 'string' && (input.moderation_status === 'rejected' || input.moderation_status === 'manual_rejected'))
    ? 'replace-image'
    : 'retry-review'
)

export const privateMessageMediaReviewMessage = (media: MediaView) => {
  if (media.status === 'deleting' || media.status === 'expired') return '图片已失效'
  if (media.moderation_status === 'manual_review') return '图片正在人工审核，请稍候'
  if (media.moderation_status === 'checking') return '图片审核中，请稍候'
  if (media.moderation_status === 'pending') return '图片正在提交审核'
  if (media.moderation_status === 'rejected' || media.moderation_status === 'manual_rejected') {
    return '图片未通过审核，请更换后重试'
  }
  if (media.moderation_status === 'error') return '图片审核暂时失败，请重试'
  return ''
}

export const privateMessageImageFrameSize = (width: number, height: number) => {
  const safeWidth = Number(width) > 0 ? Number(width) : 1
  const safeHeight = Number(height) > 0 ? Number(height) : 1
  const aspect = safeWidth / safeHeight
  const maxEdge = 260
  const minEdge = 144
  const frameWidth = aspect >= 1
    ? maxEdge
    : Math.max(minEdge, Math.round(maxEdge * aspect))
  const frameHeight = aspect >= 1
    ? Math.max(minEdge, Math.round(maxEdge / aspect))
    : maxEdge
  return { width: `${frameWidth}rpx`, height: `${frameHeight}rpx` }
}

export const privateMessageMediaReviewBackoff = (consecutiveLoadFailures: number) => {
  const failures = Math.max(0, Math.floor(consecutiveLoadFailures))
  return Math.min(
    PRIVATE_MESSAGE_MEDIA_REVIEW_MAX_BACKOFF_MS,
    PRIVATE_MESSAGE_MEDIA_REVIEW_POLL_INTERVAL_MS * (2 ** failures),
  )
}

export const pollPrivateMessageMediaReview = async (input: {
  loadMedia: () => Promise<MediaView>
  onMedia: (media: MediaView) => void
  onTransientLoadError?: (error: unknown, attempt: number) => void
  isForeground: () => boolean
  wait?: (milliseconds: number) => Promise<void>
}): Promise<PrivateMessageMediaReviewResult> => {
  const wait = input.wait || ((milliseconds: number) => new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds)
  }))
  let latestMedia: MediaView | null = null
  let consecutiveLoadFailures = 0

  for (let attempt = 0; attempt < PRIVATE_MESSAGE_MEDIA_REVIEW_MAX_ATTEMPTS; attempt += 1) {
    if (!input.isForeground()) return { kind: 'cancelled', media: latestMedia }
    let media: MediaView
    try {
      media = await input.loadMedia()
    } catch (error) {
      consecutiveLoadFailures += 1
      input.onTransientLoadError?.(error, attempt + 1)
      if (attempt + 1 < PRIVATE_MESSAGE_MEDIA_REVIEW_MAX_ATTEMPTS) {
        if (!input.isForeground()) return { kind: 'cancelled', media: latestMedia }
        await wait(privateMessageMediaReviewBackoff(consecutiveLoadFailures))
      }
      continue
    }
    consecutiveLoadFailures = 0
    latestMedia = media
    input.onMedia(media)
    const state = privateMessageMediaReviewState(media)
    if (state === 'passed') return { kind: 'passed', media }
    if (state === 'rejected') return { kind: 'rejected', media }
    if (attempt + 1 < PRIVATE_MESSAGE_MEDIA_REVIEW_MAX_ATTEMPTS) {
      await wait(privateMessageMediaReviewBackoff(consecutiveLoadFailures))
    }
  }

  return { kind: 'timeout', media: latestMedia }
}
