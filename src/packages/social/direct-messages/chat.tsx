import { useCallback, useEffect, useRef, useState } from 'react'
import Taro, { useDidHide, useDidShow, useLoad, usePullDownRefresh } from '@tarojs/taro'
import { Image, ScrollView, Text, View } from '@tarojs/components'
import { createIdempotencyKey, isApiError } from '../../../api/client'
import { getCurrentIdentity, getCurrentUser } from '../../../api/account'
import { uploadMediaImage } from '../../../api/media'
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
  privateMessageImageFrameSize,
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

const imageErrorMessage = (error: unknown, fallback: string) => (
  isApiError(error) ? error.message : error instanceof Error ? error.message : fallback
)

type ImageRecoveryAction = 'reupload' | 'send-image' | null

type PendingOutgoingImage = {
  key: string
  mediaId?: number
  previewUrl: string
  width: number
  height: number
  progress: number
  status: 'uploading' | 'sending' | 'failed'
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
  const selectedImageRef = useRef<MediaImageDraft | null>(null)
  const pendingOutgoingImageRef = useRef<PendingOutgoingImage | null>(null)
  const sentImagePreviewsRef = useRef<Record<number, SentImagePreview>>({})
  const mediaOperationVersionRef = useRef(0)

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
  }

  const resolveImagePendingSend = (activeConversationId: number, mediaId: number) => {
    const fingerprint = `image:${mediaId}`
    if (pendingSendRef.current?.payload.kind === 'image'
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
  ) => {
    const activeConversationId = conversationIdRef.current
    const isCurrentImage = () => (
      mediaOperationVersionRef.current === operationVersion
      && selectedImageRef.current?.key === image.key
      && activeConversationId === conversationIdRef.current
    )
    if (!isCurrentImage()) return
    requestWechatSubscriptionForModule('private_message')
    const pending = resolveImagePendingSend(activeConversationId, mediaId)
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
      setMessages((current) => {
        const merged = mergeDirectMessages(current, [message])
        setNewestMessageId(merged)
        return merged
      })
      handleSentImageMessage(message, { ...image, mediaId })
      return
    } catch (sendError) {
      if (!isCurrentImage()) return
      const message = imageErrorMessage(sendError, '图片发送失败，请重试')
      setImageRecoveryAction('send-image')
      updateSelectedImage((current) => current && current.key === image.key
        ? { ...current, mediaId, status: 'failed', progress: 100, error: message }
        : current)
      updatePendingOutgoingImage((current) => current && current.key === image.key
        ? { ...current, mediaId, status: 'failed', progress: 100, error: message }
        : current)
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
    updatePendingOutgoingImage((current) => current && current.key === image.key
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
      }
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

  const imageInFlight = Boolean(selectedImage && selectedImage.status !== 'failed')

  const sendFromButton = () => {
    if (!draft.trim() || sending || !conversationId) return
    requestWechatSubscriptionForModule('private_message')
    void send()
  }

  const changeStickerPickerOpen = (open: boolean) => {
    if (open && selectedImageRef.current && selectedImageRef.current.status !== 'failed') {
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
    if (selectedImageRef.current && selectedImageRef.current.status !== 'failed') return
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
    if (!image || !image.localPath) return
    resetPendingSend()
    if (imageRecoveryAction === 'send-image' && image.mediaId) {
      const operationVersion = mediaOperationVersionRef.current + 1
      mediaOperationVersionRef.current = operationVersion
      void sendUploadedImage(image, image.mediaId, operationVersion)
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

  const canSend = Boolean(conversationId) && !sending && Boolean(draft.trim())
  const pageClassName = [
    'direct-chat-page',
    stickerPickerOpen ? 'direct-chat-page--sticker-open' : '',
  ].filter(Boolean).join(' ')
const contentBottomPadding = stickerPickerOpen
  ? '676rpx'
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
                            ariaLabel='图片消息'
                          >
                            <Image
                              className='direct-chat-message__image'
                              src={localPreview.previewUrl}
                              mode='aspectFill'
                              lazyLoad
                            />
                          </View>
                        )}
                        {imagePending && !localPreview && (
                          <View
                            className='direct-chat-message__image-fallback direct-chat-message__image-fallback--pending'
                            ariaLabel='图片消息'
                          >
                            <Text>图片</Text>
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
                          {pendingOutgoingImage.status === 'failed' && (
                            <View className='direct-chat-message__image-progress-actions'>
                              <View
                                className='direct-chat-message__image-progress-action direct-chat-message__image-progress-action--primary'
                                ariaRole='button'
                                ariaLabel='重试发送图片'
                                onClick={retrySelectedImage}
                              >
                                重试
                              </View>
                              <View
                                className='direct-chat-message__image-progress-action'
                                ariaRole='button'
                                ariaLabel='删除失败图片'
                                onClick={removeSelectedImage}
                              >
                                删除
                              </View>
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
        <View className='direct-chat-composer__main'>
          <View className='direct-chat-composer__field'>
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
            className={imageInFlight
              ? 'direct-chat-composer__image-trigger direct-chat-composer__image-trigger--disabled'
              : 'direct-chat-composer__image-trigger'}
            ariaRole='button'
            ariaLabel={imageInFlight ? '图片正在自动发送，请稍候' : '选择图片'}
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
            ariaLabel={sending
              ? '正在发送消息'
              : !canSend ? '发送消息，当前不可用' : '发送消息'}
            onClick={sendFromButton}
          >
            <View className='direct-chat-composer__send-surface'>
              {sending ? (
                <View className='direct-chat-composer__send-spinner' />
              ) : (
                <Image
                  className='direct-chat-composer__send-icon'
                  src={require('../../../assets/community/send.svg')}
                  mode='aspectFit'
                />
              )}
            </View>
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
