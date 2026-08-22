import type { MediaView } from '../../api/media'

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
