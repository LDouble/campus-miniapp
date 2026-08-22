import { useCallback, useEffect, useRef, useState } from 'react'
import Taro, { useDidHide, useDidShow, useLoad, usePullDownRefresh } from '@tarojs/taro'
import { Image, ScrollView, Text, View } from '@tarojs/components'
import { createIdempotencyKey, isApiError } from '../../../api/client'
import { getCurrentIdentity, getCurrentUser } from '../../../api/account'
import {
  getMedia,
  submitPrivateMessageMediaReview,
  uploadMediaImage,
} from '../../../api/media'
import type { MediaView } from '../../../api/media'
import CustomNavbar, { getNavbarMetrics } from '../../../components/custom-navbar'
import UserAvatar from '../../../components/user-avatar'
import StickerContent from '../../../components/sticker-content'
import StickerPicker from '../../../components/sticker-picker'
import {
  KeyboardSafeInput,
  useKeyboardInset,
} from '../../../components/keyboard-safe-input'
import {
  formatMessageTimelineTime,
  shouldShowMessageTimelineTime,
} from '../../../features/messages/time'
import { parseDirectMessageConversationId } from '../../../features/direct-messages/navigation'
import {
  canLoadDirectMessagePage,
  displayedLastReceivedMessageId,
  historyPaginationFromDirectMessagePoll,
  mergeDirectMessages,
} from '../../../features/direct-messages/pagination'
import {
  resolvePendingDirectMessageSend,
  type PendingDirectMessageSend,
} from '../../../features/direct-messages/composer'
import {
  pollPrivateMessageMediaReview,
  privateMessageImageFrameSize,
  privateMessageMediaReviewMessage,
  privateMessageMediaRetryAction,
  privateMessageMediaReviewState,
  type PrivateMessageMediaReviewResult,
} from '../../../features/direct-messages/media-review'
import { insertStickerToken } from '../../../features/stickers/content'
import { privateMessagesRepository } from '../../../features/direct-messages/repository'
import {
  decrementPrivateMessageUnreadCount,
  refreshPrivateMessageUnreadCount,
} from '../../../features/direct-messages/unread'
import { requestWechatSubscriptionForModule } from '../../../features/wechat-subscription'
import { chooseMediaImages } from '../../../features/media/selection'
import type { MediaImageDraft } from '../../../features/media/images'
import type {
  DirectMessage,
  DirectMessageConversation,
} from '../../../features/direct-messages/types'
import './chat.scss'

const HISTORY_PAGE_SIZE = 50
const POLL_INTERVAL_MS = 4_000
const POLL_MAX_BACKOFF_MS = 30_000

const avatarFallback = (value: string, fallback = '海') => {
  const normalized = value.trim()
  return normalized ? normalized.slice(0, 1).toUpperCase() : fallback
}

const imageDraftStatus = (image: MediaImageDraft) => {
  if (image.status === 'uploading' && image.error) return image.error
  if (image.status === 'uploading' && image.progress < 100) {
    return `图片上传中 ${Math.max(1, Math.round(image.progress))}%`
  }
  if (image.status === 'uploading') return '图片发送中，请稍候'
  if (image.status === 'uploaded') return '图片已发送，审核中'
  if (image.status === 'failed') return image.error || '图片处理失败，请重试'
  return '准备上传图片'
}

const imageErrorMessage = (error: unknown, fallback: string) => (
  isApiError(error) ? error.message : error instanceof Error ? error.message : fallback
)

type ImageRecoveryAction = 'retry-review' | 'replace-image' | 'reupload' | 'send-image' | null

type PendingOutgoingImage = {
  key: string
  mediaId?: number
  previewUrl: string
  width: number
  height: number
  progress: number
  status: 'uploading' | 'sending' | 'reviewing' | 'failed'
  error: string
}

type SentImagePreview = {
  mediaId: number
  previewUrl: string
  width: number
  height: number
}

export default function DirectMessageChatPage() {
  const [conversationId, setConversationId] = useState(0)
  const [conversation, setConversation] = useState<DirectMessageConversation | null>(null)
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [currentUserId, setCurrentUserId] = useState(0)
  const [currentUserAvatarUrl, setCurrentUserAvatarUrl] = useState('')
  const [currentUserName, setCurrentUserName] = useState('')
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [inputFocused, setInputFocused] = useState(false)
  const [scrollTarget, setScrollTarget] = useState('')
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false)
  const [selectedImage, setSelectedImage] = useState<MediaImageDraft | null>(null)
  const [failedImageMessageIds, setFailedImageMessageIds] = useState<number[]>([])
  const [pendingOutgoingImage, setPendingOutgoingImage] = useState<PendingOutgoingImage | null>(null)
  const [sentImagePreviews, setSentImagePreviews] = useState<Record<number, SentImagePreview>>({})
  const [imageStateOverrides, setImageStateOverrides] = useState<Record<number, 'rejected' | 'expired'>>({})
  const [imageRecoveryAction, setImageRecoveryAction] = useState<ImageRecoveryAction>(null)
  const { keyboardHeight, onKeyboardVisibilityChange } = useKeyboardInset()
  const conversationIdRef = useRef(0)
  const newestMessageIdRef = useRef(0)
  const nextCursorRef = useRef<string | null>(null)
  const hasMoreRef = useRef(true)
  const initialRequestVersion = useRef(0)
  const initialLoadingRef = useRef(false)
  const historyLoadingRef = useRef(false)
  const visibleRef = useRef(false)
  const pollingRef = useRef(false)
  const pollingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollingBackoffMs = useRef(0)
  const lastReadMessageId = useRef(0)
  const pendingSendRef = useRef<PendingDirectMessageSend | null>(null)
  const pendingSendFingerprintRef = useRef('')
  const draftSelectionStartRef = useRef(0)
  const draftSelectionEndRef = useRef(0)
  const messagesRef = useRef<DirectMessage[]>([])
  const selectedImageRef = useRef<MediaImageDraft | null>(null)
  const pendingOutgoingImageRef = useRef<PendingOutgoingImage | null>(null)
  const sentImagePreviewsRef = useRef<Record<number, SentImagePreview>>({})
  const mediaOperationVersionRef = useRef(0)
  const mediaReviewInFlightRef = useRef(0)
  const sentImageReviewInFlightRef = useRef(new Set<number>())

  useEffect(() => {
    if (keyboardHeight > 0) setStickerPickerOpen(false)
  }, [keyboardHeight])

  useEffect(() => {
    if (keyboardHeight <= 0 || !newestMessageIdRef.current) return
    const target = `direct-chat-bottom-anchor-${newestMessageIdRef.current}`
    setScrollTarget('')
    Taro.nextTick(() => setScrollTarget(target))
  }, [keyboardHeight])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    if (!pendingOutgoingImage?.key) return
    const target = `direct-chat-pending-image-${pendingOutgoingImage.key}`
    setScrollTarget('')
    Taro.nextTick(() => setScrollTarget(target))
  }, [pendingOutgoingImage?.key])

  const setNewestMessageId = (items: DirectMessage[]) => {
    const newest = items.length ? items[items.length - 1].id : 0
    newestMessageIdRef.current = newest
    if (newest) setScrollTarget(`direct-chat-bottom-anchor-${newest}`)
  }

  const updateSelectedImage = useCallback((updater: (current: MediaImageDraft | null) => MediaImageDraft | null) => {
    setSelectedImage((current) => {
      const next = updater(current)
      selectedImageRef.current = next
      return next
    })
  }, [])

  const updatePendingOutgoingImage = useCallback((
    updater: (current: PendingOutgoingImage | null) => PendingOutgoingImage | null,
  ) => {
    setPendingOutgoingImage((current) => {
      const next = updater(current)
      pendingOutgoingImageRef.current = next
      return next
    })
  }, [])

  const updateSentImagePreviews = useCallback((
    updater: (current: Record<number, SentImagePreview>) => Record<number, SentImagePreview>,
  ) => {
    setSentImagePreviews((current) => {
      const next = updater(current)
      sentImagePreviewsRef.current = next
      return next
    })
  }, [])

  const resetPendingSend = () => {
    pendingSendRef.current = null
    pendingSendFingerprintRef.current = ''
  }

  const resetImageRecoveryAction = () => setImageRecoveryAction(null)

  const waitForSelectedImageReview = async (
    image: MediaImageDraft,
    operationVersion: number,
  ): Promise<PrivateMessageMediaReviewResult | null> => {
    if (!image.mediaId || mediaReviewInFlightRef.current === operationVersion) return null
    mediaReviewInFlightRef.current = operationVersion
    const isCurrentImage = () => (
      mediaOperationVersionRef.current === operationVersion
      && selectedImageRef.current?.key === image.key
    )
    try {
      const result = await pollPrivateMessageMediaReview({
        loadMedia: () => getMedia(image.mediaId as number),
        isForeground: () => visibleRef.current && isCurrentImage(),
        onTransientLoadError: () => {
          updateSelectedImage((current) => (
            isCurrentImage() && current
              ? { ...current, status: 'uploading', progress: 100, error: '网络波动，正在继续审核' }
              : current
          ))
          updatePendingOutgoingImage((current) => (
            isCurrentImage() && current
              ? { ...current, status: 'reviewing', progress: 100, error: '网络波动，正在继续审核' }
              : current
          ))
        },
        onMedia: (media) => {
          updateSelectedImage((current) => (
            isCurrentImage() && current
              ? {
                ...current,
                mediaId: media.id,
                status: 'uploading',
                progress: 100,
                error: privateMessageMediaReviewMessage(media),
              }
              : current
          ))
          updatePendingOutgoingImage((current) => (
            isCurrentImage() && current
              ? { ...current, status: 'reviewing', progress: 100, error: privateMessageMediaReviewMessage(media) }
              : current
          ))
        },
      })
      if (!isCurrentImage() || result.kind === 'cancelled') return result
      if (result.kind === 'passed') {
        resetImageRecoveryAction()
        updateSelectedImage((current) => current && current.key === image.key
          ? { ...current, status: 'uploaded', progress: 100, error: '' }
          : current)
        updatePendingOutgoingImage((current) => current && current.key === image.key
          ? { ...current, status: 'reviewing', progress: 100, error: '' }
          : current)
        return result
      }
      const reviewErrorMessage = result.kind === 'timeout'
        ? '图片审核超时，请重试'
        : result.media
          ? privateMessageMediaReviewMessage(result.media)
          : '图片未通过审核，请更换后重试'
      setImageRecoveryAction(result.media
        ? privateMessageMediaRetryAction(result.media)
        : 'retry-review')
      updateSelectedImage((current) => current && current.key === image.key
        ? { ...current, status: 'failed', error: reviewErrorMessage || '图片未通过审核，请更换后重试' }
        : current)
      updatePendingOutgoingImage((current) => current && current.key === image.key
        ? { ...current, status: 'failed', progress: 100, error: reviewErrorMessage || '图片未通过审核，请更换后重试' }
        : current)
      return result
    } catch (reviewError) {
      if (!isCurrentImage()) return null
      setImageRecoveryAction('retry-review')
      const message = imageErrorMessage(reviewError, '图片审核状态查询失败，请重试')
      updateSelectedImage((current) => current && current.key === image.key
        ? { ...current, status: 'failed', error: message }
        : current)
      updatePendingOutgoingImage((current) => current && current.key === image.key
        ? { ...current, status: 'failed', progress: 100, error: message }
        : current)
      return null
    } finally {
      if (mediaReviewInFlightRef.current === operationVersion) mediaReviewInFlightRef.current = 0
    }
  }

  const refreshConversationMessages = async (id: number) => {
    if (!id || id !== conversationIdRef.current) return
    try {
      const [page, loadedConversation] = await Promise.all([
        privateMessagesRepository.listMessages(id, { pageSize: HISTORY_PAGE_SIZE }),
        privateMessagesRepository.getConversation(id),
      ])
      if (id !== conversationIdRef.current) return
      setMessages((current) => {
        const merged = mergeDirectMessages(current, page.items)
        setNewestMessageId(merged)
        return merged
      })
      setConversation(loadedConversation)
      page.items.forEach((message) => {
        if (message.image_state?.state === 'pending' && message.image_state.media_id) {
          void startSentImageReview(message.id, message.image_state.media_id)
        }
      })
    } catch {
      // 审核结果已经在本地状态中体现；下一次会话轮询会重新获取签名图。
    }
  }

  const startSentImageReview = async (messageId: number, mediaId: number) => {
    if (!messageId || !mediaId || sentImageReviewInFlightRef.current.has(messageId)) return
    sentImageReviewInFlightRef.current.add(messageId)
    const reviewConversationId = conversationIdRef.current
    try {
      const result = await pollPrivateMessageMediaReview({
        loadMedia: () => getMedia(mediaId),
        isForeground: () => visibleRef.current && reviewConversationId === conversationIdRef.current,
        onMedia: () => undefined,
      })
      if (result.kind === 'cancelled' || reviewConversationId !== conversationIdRef.current) return
      if (result.kind === 'passed') {
        setImageStateOverrides((current) => {
          const next = { ...current }
          delete next[messageId]
          return next
        })
        updateSentImagePreviews((current) => {
          const next = { ...current }
          delete next[messageId]
          return next
        })
        await refreshConversationMessages(reviewConversationId)
        return
      }
      if (result.kind === 'rejected') {
        setImageStateOverrides((current) => ({ ...current, [messageId]: 'rejected' }))
        updateSentImagePreviews((current) => {
          const next = { ...current }
          delete next[messageId]
          return next
        })
        await refreshConversationMessages(reviewConversationId)
      }
    } finally {
      sentImageReviewInFlightRef.current.delete(messageId)
    }
  }

  const restartPendingImageReviews = () => {
    Object.entries(sentImagePreviewsRef.current).forEach(([messageId, preview]) => {
      void startSentImageReview(Number(messageId), preview.mediaId)
    })
    messagesRef.current.forEach((message) => {
      if (message.image_state?.state === 'pending' && message.image_state.media_id) {
        void startSentImageReview(message.id, message.image_state.media_id)
      }
    })
  }

  const handleSentImageMessage = (message: DirectMessage, image: MediaImageDraft) => {
    const mediaId = message.image_state?.media_id || message.image?.media_id || image.mediaId
    const state = message.image_state?.state || (message.image ? 'available' : 'pending')
    if (!mediaId || state === 'available') return
    if (state === 'rejected' || state === 'expired') {
      setImageStateOverrides((current) => ({ ...current, [message.id]: state }))
      return
    }
    updateSentImagePreviews((current) => ({
      ...current,
      [message.id]: {
        mediaId,
        previewUrl: image.previewUrl,
        width: image.width,
        height: image.height,
      },
    }))
    void startSentImageReview(message.id, mediaId)
  }

  const resolveImagePendingSend = (activeConversationId: number, mediaId: number, forceNewKey = false) => {
    const fingerprint = `image:${mediaId}`
    if (!forceNewKey && pendingSendRef.current?.payload.kind === 'image'
      && pendingSendFingerprintRef.current === fingerprint) {
      return pendingSendRef.current
    }
    const pending: PendingDirectMessageSend = {
      payload: { kind: 'image', mediaId },
      fingerprint,
      idempotencyKey: createIdempotencyKey(`private-message:${activeConversationId}:image`),
    }
    pendingSendRef.current = pending
    pendingSendFingerprintRef.current = fingerprint
    return pending
  }

  const sendUploadedImage = async (
    image: MediaImageDraft,
    mediaId: number,
    operationVersion: number,
    forceNewKey = false,
  ) => {
    const activeConversationId = conversationIdRef.current
    const isCurrentImage = () => (
      mediaOperationVersionRef.current === operationVersion
      && selectedImageRef.current?.key === image.key
      && activeConversationId === conversationIdRef.current
    )
    if (!isCurrentImage()) return
    requestWechatSubscriptionForModule('private_message')
    const pending = resolveImagePendingSend(activeConversationId, mediaId, forceNewKey)
    setSending(true)
    setImageRecoveryAction('send-image')
    updateSelectedImage((current) => current && current.key === image.key
      ? { ...current, mediaId, status: 'uploading', progress: 100, error: '图片发送中，请稍候' }
      : current)
    updatePendingOutgoingImage((current) => current && current.key === image.key
      ? { ...current, status: 'sending', progress: 100, error: '' }
      : current)
    try {
      const message = await privateMessagesRepository.sendMessage(
        activeConversationId,
        pending.payload,
        pending.idempotencyKey,
      )
      if (!isCurrentImage()) return
      resetPendingSend()
      resetImageRecoveryAction()
      mediaOperationVersionRef.current += 1
      updateSelectedImage(() => null)
      updatePendingOutgoingImage(() => null)
      setSending(false)
      setMessages((current) => {
        const merged = mergeDirectMessages(current, [message])
        setNewestMessageId(merged)
        return merged
      })
      handleSentImageMessage(message, { ...image, mediaId })
      return
    } catch (sendError) {
      if (!isCurrentImage()) return
      let media: MediaView | null = null
      if (isApiError(sendError) && ['invalid_private_message', 'invalid_media'].includes(sendError.code)) {
        try {
          media = await getMedia(mediaId)
        } catch {
          media = null
        }
      }
      if (media && privateMessageMediaReviewState(media) === 'pending') {
        updatePendingOutgoingImage((current) => current && current.key === image.key
          ? { ...current, status: 'reviewing', progress: 100, error: '当前服务正在兼容旧版流程，等待审核后发送' }
          : current)
        updateSelectedImage((current) => current && current.key === image.key
          ? { ...current, status: 'uploading', progress: 100, error: '图片审核中，审核通过后自动发送' }
          : current)
        try {
          await submitPrivateMessageMediaReview(mediaId)
          if (!isCurrentImage()) return
          const review = await waitForSelectedImageReview({
            ...image,
            mediaId,
            status: 'uploading',
            progress: 100,
            error: '',
          }, operationVersion)
          if (review?.kind === 'passed' && isCurrentImage()) {
            resetPendingSend()
            await sendUploadedImage({ ...image, mediaId }, mediaId, operationVersion, true)
          }
          return
        } catch (reviewError) {
          if (!isCurrentImage()) return
          const message = imageErrorMessage(reviewError, '图片审核提交失败，请重试')
          setImageRecoveryAction('retry-review')
          updateSelectedImage((current) => current && current.key === image.key
            ? { ...current, status: 'failed', error: message }
            : current)
          updatePendingOutgoingImage((current) => current && current.key === image.key
            ? { ...current, status: 'failed', progress: 100, error: message }
            : current)
          return
        }
      }
      const mediaState = media ? privateMessageMediaReviewState(media) : null
      const rejectedMedia = mediaState === 'rejected' ? media : null
      const message = rejectedMedia
        ? privateMessageMediaReviewMessage(rejectedMedia) || '图片未通过审核，请更换后重试'
        : imageErrorMessage(sendError, '图片发送失败，请重试')
      setImageRecoveryAction(media ? privateMessageMediaRetryAction(media) : 'send-image')
      updateSelectedImage((current) => current && current.key === image.key
        ? { ...current, mediaId, status: 'failed', progress: 100, error: message }
        : current)
      updatePendingOutgoingImage((current) => current && current.key === image.key
        ? { ...current, mediaId, status: 'failed', progress: 100, error: message }
        : current)
    } finally {
      if (isCurrentImage()) setSending(false)
    }
  }

  const uploadSelectedImage = async (image: MediaImageDraft) => {
    const operationVersion = mediaOperationVersionRef.current + 1
    mediaOperationVersionRef.current = operationVersion
    const isCurrentImage = () => (
      mediaOperationVersionRef.current === operationVersion
      && selectedImageRef.current?.key === image.key
    )
    updateSelectedImage((current) => current && current.key === image.key
      ? { ...current, mediaId: undefined, status: 'uploading', progress: 0, error: '' }
      : current)
    setImageRecoveryAction('reupload')
    let uploadedMediaId = 0
    try {
      const media = await uploadMediaImage({
        purpose: 'private_message',
        filePath: image.localPath,
        mimeType: image.mimeType,
        sizeBytes: image.sizeBytes,
        onProgress: (progress) => {
          if (!isCurrentImage()) return
          updateSelectedImage((current) => current && current.key === image.key
            ? { ...current, status: 'uploading', progress, error: '' }
            : current)
          updatePendingOutgoingImage((current) => current && current.key === image.key
            ? { ...current, status: 'uploading', progress, error: '' }
            : current)
        },
      })
      if (!isCurrentImage()) return
      uploadedMediaId = media.id
      updateSelectedImage((current) => current && current.key === image.key
        ? { ...current, mediaId: media.id, status: 'uploading', progress: 100, error: '' }
        : current)
      updatePendingOutgoingImage((current) => current && current.key === image.key
        ? { ...current, mediaId: media.id, status: 'sending', progress: 100, error: '' }
        : current)
      await sendUploadedImage({ ...image, mediaId: media.id }, media.id, operationVersion)
    } catch (uploadError) {
      if (!isCurrentImage()) return
      const message = imageErrorMessage(uploadError, '图片上传失败，请重试')
      setImageRecoveryAction(uploadedMediaId > 0 ? 'send-image' : 'reupload')
      updateSelectedImage((current) => current && current.key === image.key
        ? {
          ...current,
          mediaId: uploadedMediaId || undefined,
          status: 'failed',
          error: message,
        }
        : current)
      updatePendingOutgoingImage((current) => current && current.key === image.key
        ? { ...current, status: 'failed', progress: uploadedMediaId > 0 ? 100 : current.progress, error: message }
        : current)
    }
  }

  const retrySelectedImageReview = async (image: MediaImageDraft) => {
    if (!image.mediaId) return
    const operationVersion = mediaOperationVersionRef.current + 1
    mediaOperationVersionRef.current = operationVersion
    const isCurrentImage = () => (
      mediaOperationVersionRef.current === operationVersion
      && selectedImageRef.current?.key === image.key
    )
    updateSelectedImage((current) => current && current.key === image.key
      ? { ...current, status: 'uploading', progress: 100, error: '' }
      : current)
    try {
      await submitPrivateMessageMediaReview(image.mediaId)
      if (!isCurrentImage()) return
      const review = await waitForSelectedImageReview({
        ...image,
        status: 'uploading',
        progress: 100,
        error: '',
      }, operationVersion)
      if (review?.kind === 'passed' && isCurrentImage()) {
        resetPendingSend()
        await sendUploadedImage(image, image.mediaId, operationVersion, true)
      }
    } catch (reviewError) {
      if (!isCurrentImage()) return
      setImageRecoveryAction('retry-review')
      updateSelectedImage((current) => current && current.key === image.key
        ? {
          ...current,
          status: 'failed',
          error: imageErrorMessage(reviewError, '图片审核提交失败，请重试'),
        }
        : current)
    }
  }

  const markDisplayedMessagesRead = useCallback(async (
    displayed: DirectMessage[],
    currentUser: number,
    activeConversation: DirectMessageConversation,
  ) => {
    const messageId = displayedLastReceivedMessageId(displayed, currentUser)
    if (!messageId || messageId <= lastReadMessageId.current) return
    try {
      await privateMessagesRepository.markRead(activeConversation.id, messageId)
      lastReadMessageId.current = messageId
      if (activeConversation.unread_count > 0) {
        decrementPrivateMessageUnreadCount(activeConversation.unread_count)
        setConversation((current) => current && current.id === activeConversation.id
          ? { ...current, unread_count: 0 }
          : current)
      }
      void refreshPrivateMessageUnreadCount(true).catch(() => undefined)
    } catch {
      // 下次数据更新会再次尝试；已读水位失败不能打断阅读。
    }
  }, [])

  const loadInitial = async (id: number) => {
    if (!id) {
      setLoading(false)
      setError('会话参数无效')
      return
    }
    const version = initialRequestVersion.current + 1
    const conversationChanged = conversationIdRef.current !== id
    initialRequestVersion.current = version
    initialLoadingRef.current = true
    conversationIdRef.current = id
    setConversationId(id)
    setLoading(true)
    setError('')
    setMessages([])
    if (conversationChanged) {
      sentImageReviewInFlightRef.current.clear()
      updateSentImagePreviews(() => ({}))
      setImageStateOverrides({})
      mediaOperationVersionRef.current += 1
      resetPendingSend()
      resetImageRecoveryAction()
      updateSelectedImage(() => null)
      updatePendingOutgoingImage(() => null)
    }
    newestMessageIdRef.current = 0
    nextCursorRef.current = null
    hasMoreRef.current = true
    try {
      const [loadedConversation, page, identity, currentUser] = await Promise.all([
        privateMessagesRepository.getConversation(id),
        privateMessagesRepository.listMessages(id, { pageSize: HISTORY_PAGE_SIZE }),
        getCurrentIdentity(),
        getCurrentUser().catch(() => null),
      ])
      if (version !== initialRequestVersion.current) return
      const resolvedMessages = mergeDirectMessages([], page.items)
      const resolvedCursor = page.next_cursor || null
      setConversation(loadedConversation)
      setCurrentUserId(identity.user_id)
      setCurrentUserAvatarUrl(currentUser?.user.avatar_url?.trim() || '')
      setCurrentUserName(currentUser?.user.username?.trim() || '')
      setMessages(resolvedMessages)
      setNewestMessageId(resolvedMessages)
      page.items.forEach((message) => {
        if (message.image_state?.state === 'pending' && message.image_state.media_id) {
          void startSentImageReview(message.id, message.image_state.media_id)
        }
      })
      nextCursorRef.current = resolvedCursor
      hasMoreRef.current = page.has_more
      setHasMore(page.has_more)
    } catch (loadError) {
      if (version === initialRequestVersion.current) {
        setError(isApiError(loadError) ? loadError.message : '会话加载失败，请稍后重试')
      }
    } finally {
      if (version === initialRequestVersion.current) {
        initialLoadingRef.current = false
        setLoading(false)
        if (visibleRef.current) schedulePolling()
      }
      Taro.stopPullDownRefresh()
    }
  }

  const loadHistory = async () => {
    const id = conversationIdRef.current
    if (!id || !canLoadDirectMessagePage(
      historyLoadingRef.current,
      hasMoreRef.current,
      nextCursorRef.current,
    )) return
    historyLoadingRef.current = true
    setLoadingHistory(true)
    try {
      const page = await privateMessagesRepository.listMessages(id, {
        cursor: nextCursorRef.current || undefined,
        pageSize: HISTORY_PAGE_SIZE,
      })
      if (id !== conversationIdRef.current) return
      setMessages((current) => mergeDirectMessages(current, page.items))
      const resolvedCursor = page.next_cursor || null
      nextCursorRef.current = resolvedCursor
      hasMoreRef.current = page.has_more
      setHasMore(page.has_more)
    } catch (loadError) {
      if (id === conversationIdRef.current) {
        Taro.showToast({
          title: isApiError(loadError) ? loadError.message : '历史消息加载失败',
          icon: 'none',
        })
      }
    } finally {
      historyLoadingRef.current = false
      setLoadingHistory(false)
    }
  }

  const pollNewMessages = async () => {
    const id = conversationIdRef.current
    if (!visibleRef.current || !id || pollingRef.current) return
    if (initialLoadingRef.current) {
      schedulePolling()
      return
    }
    pollingRef.current = true
    try {
      const afterId = newestMessageIdRef.current
      const page = await privateMessagesRepository.listMessages(id, {
        afterId: afterId || undefined,
        pageSize: HISTORY_PAGE_SIZE,
      })
      if (id !== conversationIdRef.current) return
      const historyPagination = historyPaginationFromDirectMessagePoll(afterId, page)
      if (historyPagination) {
        nextCursorRef.current = historyPagination.nextCursor
        hasMoreRef.current = historyPagination.hasMore
        setHasMore(historyPagination.hasMore)
      }
      if (page.items.length) {
        setMessages((current) => {
          const merged = mergeDirectMessages(current, page.items)
          setNewestMessageId(merged)
          return merged
        })
        page.items.forEach((message) => {
          if (message.image_state?.state === 'pending' && message.image_state.media_id) {
            void startSentImageReview(message.id, message.image_state.media_id)
          }
        })
      }
      restartPendingImageReviews()
      pollingBackoffMs.current = 0
    } catch {
      pollingBackoffMs.current = Math.min(
        pollingBackoffMs.current ? pollingBackoffMs.current * 2 : POLL_INTERVAL_MS * 2,
        POLL_MAX_BACKOFF_MS,
      )
    } finally {
      pollingRef.current = false
      if (visibleRef.current && id === conversationIdRef.current) schedulePolling()
    }
  }

  const stopPolling = () => {
    if (pollingTimer.current) clearTimeout(pollingTimer.current)
    pollingTimer.current = null
  }

  const schedulePolling = () => {
    stopPolling()
    if (!visibleRef.current || !conversationIdRef.current) return
    const delay = pollingBackoffMs.current || POLL_INTERVAL_MS
    pollingTimer.current = setTimeout(() => void pollNewMessages(), delay)
  }

  useLoad((options) => {
    const id = parseDirectMessageConversationId(options.id)
    void loadInitial(id)
  })

  useDidShow(() => {
    visibleRef.current = true
    void refreshPrivateMessageUnreadCount(true).catch(() => undefined)
    const image = selectedImageRef.current
    if (image && image.mediaId && image.status === 'uploading') {
      void waitForSelectedImageReview(image, mediaOperationVersionRef.current)
    }
    restartPendingImageReviews()
    schedulePolling()
  })

  useDidHide(() => {
    visibleRef.current = false
    stopPolling()
  })

  useEffect(() => () => stopPolling(), [])

  useEffect(() => {
    if (!conversation || !currentUserId || messages.length === 0) return
    void markDisplayedMessagesRead(messages, currentUserId, conversation)
  }, [conversation, currentUserId, markDisplayedMessagesRead, messages])

  usePullDownRefresh(() => void loadInitial(conversationIdRef.current))

  const send = async () => {
    const id = conversationIdRef.current
    if (!id || sending) return
    const pending = resolvePendingDirectMessageSend(
      {
        draft,
        mediaId: selectedImage?.status === 'uploaded' ? selectedImage.mediaId : undefined,
        pending: pendingSendRef.current,
        pendingFingerprint: pendingSendFingerprintRef.current,
        createKey: () => createIdempotencyKey(`private-message:${id}`),
      },
    )
    if (!pending) return
    pendingSendRef.current = pending
    pendingSendFingerprintRef.current = pending.fingerprint
    setSending(true)
    try {
      const message = await privateMessagesRepository.sendMessage(
        id,
        pending.payload,
        pending.idempotencyKey,
      )
      if (pendingSendRef.current === pending) {
        resetPendingSend()
        if (pending.payload.kind === 'image') {
          const mediaId = pending.payload.mediaId
          mediaOperationVersionRef.current += 1
          resetImageRecoveryAction()
          updateSelectedImage((current) => current?.mediaId === mediaId ? null : current)
        } else {
          setDraft((current) => {
            if (current !== draft) return current
            draftSelectionStartRef.current = 0
            draftSelectionEndRef.current = 0
            return ''
          })
        }
      }
      setMessages((current) => {
        const merged = mergeDirectMessages(current, [message])
        setNewestMessageId(merged)
        return merged
      })
    } catch (sendError) {
      Taro.showToast({
        title: isApiError(sendError) ? sendError.message : '发送失败，请稍后重试',
        icon: 'none',
      })
    } finally {
      setSending(false)
    }
  }

  const updateDraft = (value: string) => {
    setDraft(value)
    if (pendingSendRef.current?.payload.kind === 'text'
      && pendingSendRef.current.fingerprint !== `text:${value}`) {
      resetPendingSend()
    }
  }

  const sendFromButton = () => {
    if (!draft.trim() || selectedImage || sending || !conversationId) return
    requestWechatSubscriptionForModule('private_message')
    void send()
  }

  const changeStickerPickerOpen = (open: boolean) => {
    if (open && selectedImageRef.current) {
      Taro.showToast({ title: '图片消息不能与表情混发', icon: 'none' })
      return
    }
    setStickerPickerOpen(open)
    if (open) void Taro.hideKeyboard()
  }

  const dismissKeyboard = () => {
    setInputFocused(false)
    setStickerPickerOpen(false)
    onKeyboardVisibilityChange(0)
    void Taro.hideKeyboard().catch(() => undefined)
  }

  const chooseImage = async () => {
    if (selectedImageRef.current) return
    if (draft.trim()) {
      Taro.showToast({ title: '图片消息不能与文字混发，请先发送或清空文字', icon: 'none' })
      return
    }
    setStickerPickerOpen(false)
    void Taro.hideKeyboard()
    try {
      const images = await chooseMediaImages({ count: 1 })
      const image = images[0]
      if (!image) return
      resetPendingSend()
      resetImageRecoveryAction()
      updateSelectedImage(() => image)
      updatePendingOutgoingImage(() => ({
        key: image.key,
        previewUrl: image.previewUrl,
        width: image.width,
        height: image.height,
        progress: 0,
        status: 'uploading',
        error: '',
      }))
      void uploadSelectedImage(image)
    } catch (chooseError) {
      Taro.showToast({
        title: imageErrorMessage(chooseError, '图片选择失败，请重试'),
        icon: 'none',
      })
    }
  }

  const retrySelectedImage = () => {
    const image = selectedImageRef.current
    if (!image || !image.localPath || sending) return
    if (imageRecoveryAction === 'replace-image') {
      Taro.showToast({ title: '图片未通过审核，请删除后更换图片', icon: 'none' })
      return
    }
    resetPendingSend()
    if (imageRecoveryAction === 'send-image' && image.mediaId) {
      const operationVersion = mediaOperationVersionRef.current + 1
      mediaOperationVersionRef.current = operationVersion
      void sendUploadedImage(image, image.mediaId, operationVersion)
      return
    }
    if (imageRecoveryAction === 'retry-review' && image.mediaId) {
      void retrySelectedImageReview(image)
      return
    }
    void uploadSelectedImage({
      ...image,
      mediaId: undefined,
      status: 'ready',
      progress: 0,
      error: '',
    })
  }

  const removeSelectedImage = () => {
    mediaOperationVersionRef.current += 1
    setSending(false)
    resetPendingSend()
    resetImageRecoveryAction()
    updateSelectedImage(() => null)
    updatePendingOutgoingImage(() => null)
  }

  const markMessageImageFailed = (messageId: number) => {
    setFailedImageMessageIds((current) => (
      current.includes(messageId) ? current : [...current, messageId]
    ))
  }

  const retryMessageImage = (messageId: number) => {
    setFailedImageMessageIds((current) => current.filter((id) => id !== messageId))
    void loadInitial(conversationIdRef.current)
  }

  const peerName = conversation?.peer.deleted
    ? '已注销用户'
    : conversation?.peer.nickname || '私信'

  const canSend = Boolean(conversationId) && !sending && !selectedImage && Boolean(draft.trim())
  const pageClassName = [
    'direct-chat-page',
    stickerPickerOpen ? 'direct-chat-page--sticker-open' : '',
    selectedImage ? 'direct-chat-page--image-selected' : '',
  ].filter(Boolean).join(' ')
const contentBottomPadding = stickerPickerOpen
  ? '676rpx'
  : selectedImage
    ? '366rpx'
    : '112rpx'
  const contentStyle = {
    paddingBottom: '0',
  }
  const navbarMetrics = getNavbarMetrics()
  const navbarHeight = navbarMetrics.statusBarHeight + navbarMetrics.navigationBarHeight
  const bottomAnchorId = `direct-chat-bottom-anchor-${newestMessageIdRef.current || 'empty'}`
  const bottomSpacerStyle = {
    height: `calc(${contentBottomPadding} + env(safe-area-inset-bottom))`,
  }
  const scrollStyle = {
    height: `calc(100vh - ${navbarHeight + keyboardHeight}px)`,
  }

  return (
    <View className={pageClassName}>
      <CustomNavbar title={peerName} showBack />
      <ScrollView
        className='direct-chat-page__scroll'
        style={scrollStyle}
        scrollY
        enhanced
        showScrollbar={false}
        upperThreshold={100}
        scrollIntoView={scrollTarget}
        onTouchStart={dismissKeyboard}
        onScrollStart={dismissKeyboard}
        onScrollToUpper={() => void loadHistory()}
      >
        <View className='direct-chat-page__content' style={contentStyle}>
          {loading && <View className='direct-chat-state'>正在加载会话</View>}
          {!loading && error && (
            <View className='direct-chat-state direct-chat-state--error'>
              <Text>{error}</Text>
              {conversationId > 0 && <View onClick={() => void loadInitial(conversationId)}>重新加载</View>}
            </View>
          )}
          {!loading && !error && (
            <>
              {hasMore && (
                <View
                  className='direct-chat-history'
                  ariaRole='button'
                  ariaLabel='加载更早消息'
                  onClick={() => void loadHistory()}
                >
                  {loadingHistory ? '正在加载更早消息' : '查看更早消息'}
                </View>
              )}
              {!hasMore && messages.length > 0 && <View className='direct-chat-history'>已经是最早的消息</View>}
              {messages.length === 0 && !pendingOutgoingImage && (
                <View className='direct-chat-empty'>
                  <Text>还没有消息</Text>
                  <Text>发一句问候，开始聊天吧</Text>
                </View>
              )}
              {messages.map((message, index) => {
                const isOwn = message.sender_id === currentUserId
                const image = message.image
                const imageState = (imageStateOverrides[message.id]
                  || message.image_state?.state
                  || (image ? 'available' : '')) as 'pending' | 'available' | 'rejected' | 'expired' | ''
                const imageFailed = Boolean(image) && imageState === 'available' && failedImageMessageIds.includes(message.id)
                const imagePending = imageState === 'pending'
                const imageUnavailable = imageState === 'rejected' || imageState === 'expired'
                const localPreview = sentImagePreviews[message.id]
                const previousMessage = messages[index - 1]
                const avatarName = isOwn
                  ? avatarFallback(currentUserName)
                  : conversation?.peer.deleted
                    ? '已'
                    : conversation?.peer.nickname.slice(0, 1) || '同'
                return (
                  <View
                    key={message.id}
                    id={`direct-message-${message.id}`}
                    className='direct-chat-message-group'
                  >
                    {shouldShowMessageTimelineTime(
                      message.created_at,
                      previousMessage?.created_at,
                    ) && (
                      <View className='direct-chat-time-divider'>
                        {formatMessageTimelineTime(message.created_at)}
                      </View>
                    )}
                    <View className={isOwn ? 'direct-chat-message direct-chat-message--own' : 'direct-chat-message'}>
                      {!isOwn && (
                        <UserAvatar
                          src={conversation?.peer.avatar_url}
                          className='direct-chat-message__avatar'
                          fallback={avatarName}
                          shape='rounded'
                          userId={conversation?.peer.id}
                        />
                      )}
                      <View className='direct-chat-message__body'>
                        {image && !imageFailed && !imagePending && !imageUnavailable && (
                          <View
                            className='direct-chat-message__image-frame'
                            style={privateMessageImageFrameSize(image.width, image.height)}
                            ariaRole='button'
                            ariaLabel='预览图片消息'
                            onClick={() => void Taro.previewImage({
                              current: image.url,
                              urls: [image.url],
                            })}
                          >
                            <Image
                              className='direct-chat-message__image'
                              src={image.url}
                              mode='aspectFill'
                              lazyLoad
                              onError={() => markMessageImageFailed(message.id)}
                            />
                          </View>
                        )}
                        {imagePending && localPreview && (
                          <View
                            className='direct-chat-message__image-frame direct-chat-message__image-frame--pending'
                            style={privateMessageImageFrameSize(localPreview.width, localPreview.height)}
                            ariaLabel='图片正在审核中'
                          >
                            <Image
                              className='direct-chat-message__image'
                              src={localPreview.previewUrl}
                              mode='aspectFill'
                              lazyLoad
                            />
                            <View className='direct-chat-message__image-progress'>
                              <Text>图片审核中</Text>
                              <View className='direct-chat-message__image-progress-track'>
                                <View className='direct-chat-message__image-progress-indicator' />
                              </View>
                            </View>
                          </View>
                        )}
                        {imagePending && !localPreview && (
                          <View
                            className='direct-chat-message__image-fallback direct-chat-message__image-fallback--pending'
                            ariaLabel='图片正在审核中'
                          >
                            <Text>图片审核中</Text>
                            <Text>审核通过后显示</Text>
                          </View>
                        )}
                        {imageUnavailable && (
                          <View
                            className='direct-chat-message__image-fallback direct-chat-message__image-fallback--invalid'
                            ariaLabel='图片已失效'
                          >
                            <Text>图片已失效</Text>
                          </View>
                        )}
                        {image && imageFailed && (
                          <View
                            className='direct-chat-message__image-fallback'
                            ariaRole='button'
                            ariaLabel='重新加载图片消息'
                            onClick={() => retryMessageImage(message.id)}
                          >
                            <Text>图片加载失败</Text>
                            <Text>点击重新加载</Text>
                          </View>
                        )}
                        {!image && !imageState && (
                          <StickerContent
                            content={message.content}
                            className='direct-chat-message__content'
                            stickerClassName='direct-chat-message__sticker'
                          />
                        )}
                      </View>
                      {isOwn && (
                        <UserAvatar
                          src={currentUserAvatarUrl}
                          className='direct-chat-message__avatar'
                          fallback={avatarName}
                          shape='rounded'
                          userId={currentUserId}
                        />
                      )}
                    </View>
                  </View>
                )
              })}
              {pendingOutgoingImage && (
                <View
                  id={`direct-chat-pending-image-${pendingOutgoingImage.key}`}
                  className='direct-chat-message-group direct-chat-message-group--pending'
                >
                  <View className='direct-chat-message direct-chat-message--own'>
                    <View className='direct-chat-message__body'>
                      <View
                        className='direct-chat-message__image-frame direct-chat-message__image-frame--pending'
                        style={privateMessageImageFrameSize(pendingOutgoingImage.width, pendingOutgoingImage.height)}
                        ariaLabel='图片正在发送'
                      >
                        <Image
                          className='direct-chat-message__image'
                          src={pendingOutgoingImage.previewUrl}
                          mode='aspectFill'
                        />
                        <View className='direct-chat-message__image-progress'>
                          <Text>
                            {pendingOutgoingImage.status === 'uploading'
                              ? `上传中 ${Math.max(1, Math.round(pendingOutgoingImage.progress))}%`
                              : pendingOutgoingImage.status === 'sending'
                                ? '发送中'
                                : pendingOutgoingImage.status === 'reviewing'
                                  ? '审核中'
                                  : pendingOutgoingImage.error || '图片发送失败'}
                          </Text>
                          {pendingOutgoingImage.status !== 'failed' && (
                            <View className='direct-chat-message__image-progress-track'>
                              <View
                                className={pendingOutgoingImage.status === 'uploading'
                                  ? 'direct-chat-message__image-progress-indicator direct-chat-message__image-progress-indicator--determinate'
                                  : 'direct-chat-message__image-progress-indicator'}
                                style={pendingOutgoingImage.status === 'uploading'
                                  ? { width: `${Math.max(4, Math.min(100, pendingOutgoingImage.progress))}%` }
                                  : undefined}
                              />
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                    <UserAvatar
                      src={currentUserAvatarUrl}
                      className='direct-chat-message__avatar'
                      fallback={avatarFallback(currentUserName)}
                      shape='rounded'
                      userId={currentUserId}
                    />
                  </View>
                </View>
              )}
              <View className='direct-chat-bottom-spacer' style={bottomSpacerStyle} />
              <View id={bottomAnchorId} className='direct-chat-bottom-anchor' />
            </>
          )}
        </View>
      </ScrollView>
      <View
        className='direct-chat-composer'
        style={{ bottom: `${keyboardHeight}px` }}
      >
        {selectedImage && (
          <View className='direct-chat-composer__image-draft'>
            <Image
              className='direct-chat-composer__image-preview'
              src={selectedImage.previewUrl}
              mode='aspectFill'
            />
            <View className='direct-chat-composer__image-meta'>
              <Text>{imageDraftStatus(selectedImage)}</Text>
              {selectedImage.status === 'failed' && imageRecoveryAction !== 'replace-image' ? (
                <View
                  className='direct-chat-composer__image-action'
                  ariaRole='button'
                  ariaLabel='重试上传图片'
                  onClick={retrySelectedImage}
                >
                重试
              </View>
              ) : null}
            </View>
            {selectedImage.status === 'uploading' && selectedImage.progress < 100 && (
              <View className='direct-chat-composer__image-progress-track'>
                <View
                  className='direct-chat-composer__image-progress-indicator'
                  style={{ width: `${Math.max(4, Math.min(100, selectedImage.progress))}%` }}
                />
              </View>
            )}
            <View
              className='direct-chat-composer__image-remove'
              ariaRole='button'
              ariaLabel='删除待发送图片'
              onClick={removeSelectedImage}
            >
              删除
            </View>
          </View>
        )}
        <View className='direct-chat-composer__main'>
          <View className='direct-chat-composer__field'>
            {selectedImage ? (
              <Text className='direct-chat-composer__image-hint'>图片将单独发送</Text>
            ) : (
              <KeyboardSafeInput
                value={draft}
                focus={inputFocused}
                maxlength={2000}
                placeholder='输入消息'
                placeholderClass='direct-chat-composer__placeholder'
                confirmType='send'
                keepVisibleOnKeyboard={false}
                onFocus={() => {
                  setInputFocused(true)
                  setStickerPickerOpen(false)
                }}
                onBlur={() => setInputFocused(false)}
                onKeyboardVisibilityChange={onKeyboardVisibilityChange}
                onInput={(event) => {
                  const detail = event.detail as typeof event.detail & {
                    cursor?: number
                    selectionEnd?: number
                    selectionStart?: number
                  }
                  const cursor = Number.isFinite(detail.cursor) ? Number(detail.cursor) : detail.value.length
                  const selectionStart = Number.isFinite(detail.selectionStart)
                    ? Number(detail.selectionStart)
                    : cursor
                  const selectionEnd = Number.isFinite(detail.selectionEnd)
                    ? Number(detail.selectionEnd)
                    : cursor
                  draftSelectionStartRef.current = Math.max(0, selectionStart)
                  draftSelectionEndRef.current = Math.max(draftSelectionStartRef.current, selectionEnd)
                  updateDraft(detail.value)
                }}
                onSelectionChange={(event) => {
                  const detail = event.detail as {
                    selectionEnd?: number
                    selectionStart?: number
                  }
                  const selectionStart = Number(detail.selectionStart)
                  const selectionEnd = Number(detail.selectionEnd)
                  if (!Number.isFinite(selectionStart) || !Number.isFinite(selectionEnd)) return
                  draftSelectionStartRef.current = Math.max(0, selectionStart)
                  draftSelectionEndRef.current = Math.max(draftSelectionStartRef.current, selectionEnd)
                }}
                onConfirm={() => void send()}
              />
            )}
          </View>
          <View
            className={stickerPickerOpen
              ? 'direct-chat-composer__sticker direct-chat-composer__sticker--active'
              : 'direct-chat-composer__sticker'}
            ariaRole='button'
            ariaLabel={stickerPickerOpen ? '收起表情面板' : '选择表情'}
            onClick={() => changeStickerPickerOpen(!stickerPickerOpen)}
          >
            <Image
              className='direct-chat-composer__sticker-icon'
              src={require('../../../assets/icons/smile.svg')}
              mode='aspectFit'
            />
          </View>
          <View
            className={selectedImage
              ? 'direct-chat-composer__image-trigger direct-chat-composer__image-trigger--disabled'
              : 'direct-chat-composer__image-trigger'}
            ariaRole='button'
            ariaLabel={selectedImage ? '图片正在自动发送，请稍候' : '选择图片'}
            onClick={() => void chooseImage()}
          >
            <Image
              className='direct-chat-composer__image-trigger-icon'
              src={require('../../../assets/icons/image.svg')}
              mode='aspectFit'
            />
          </View>
          <View
            className={[
              'direct-chat-composer__send',
              !canSend ? 'direct-chat-composer__send--disabled' : '',
            ].filter(Boolean).join(' ')}
            ariaRole='button'
            ariaLabel={selectedImage
              ? '图片正在自动发送'
              : sending
              ? '正在发送消息'
              : !canSend ? '发送消息，当前不可用' : '发送消息'}
            onClick={sendFromButton}
          >
            {selectedImage ? (sending ? '发送中' : '自动发送') : sending ? '发送中' : '发送'}
          </View>
        </View>
        <StickerPicker
          open={stickerPickerOpen}
          className={stickerPickerOpen
            ? 'direct-chat-sticker-picker direct-chat-sticker-picker--open'
            : 'direct-chat-sticker-picker'}
          onOpenChange={changeStickerPickerOpen}
          onSelect={(sticker) => {
            const inserted = insertStickerToken(
              draft,
              sticker.id,
              draftSelectionStartRef.current,
              draftSelectionEndRef.current,
            )
            draftSelectionStartRef.current = inserted.cursor
            draftSelectionEndRef.current = inserted.cursor
            updateDraft(inserted.text)
          }}
        />
      </View>
    </View>
  )
}
