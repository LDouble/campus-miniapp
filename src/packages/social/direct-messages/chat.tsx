import { useCallback, useEffect, useRef, useState } from 'react'
import Taro, { useDidHide, useDidShow, useLoad, usePullDownRefresh } from '@tarojs/taro'
import { Image, ScrollView, Text, View } from '@tarojs/components'
import { createIdempotencyKey, isApiError } from '../../../api/client'
import { getCurrentIdentity } from '../../../api/account'
import {
  getMedia,
  submitPrivateMessageMediaReview,
  uploadMediaImage,
} from '../../../api/media'
import CustomNavbar from '../../../components/custom-navbar'
import StickerContent from '../../../components/sticker-content'
import StickerPicker from '../../../components/sticker-picker'
import {
  KeyboardSafeInput,
  useKeyboardInset,
} from '../../../components/keyboard-safe-input'
import { formatDateTime } from '../../../features/life-services/format'
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

const imageDraftStatus = (image: MediaImageDraft) => {
  if (image.status === 'uploading' && image.error) return image.error
  if (image.status === 'uploading' && image.progress < 100) {
    return `图片上传中 ${Math.max(1, Math.round(image.progress))}%`
  }
  if (image.status === 'uploading') return '图片审核中，请稍候'
  if (image.status === 'uploaded') return '审核通过，可以发送'
  if (image.status === 'failed') return image.error || '图片处理失败，请重试'
  return '准备上传图片'
}

const imageErrorMessage = (error: unknown, fallback: string) => (
  isApiError(error) ? error.message : error instanceof Error ? error.message : fallback
)

type ImageRecoveryAction = 'retry-review' | 'replace-image' | 'reupload' | null

export default function DirectMessageChatPage() {
  const [conversationId, setConversationId] = useState(0)
  const [conversation, setConversation] = useState<DirectMessageConversation | null>(null)
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [currentUserId, setCurrentUserId] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [scrollTarget, setScrollTarget] = useState('')
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false)
  const [selectedImage, setSelectedImage] = useState<MediaImageDraft | null>(null)
  const [failedImageMessageIds, setFailedImageMessageIds] = useState<number[]>([])
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
  const mediaOperationVersionRef = useRef(0)
  const mediaReviewInFlightRef = useRef(0)

  useEffect(() => {
    if (keyboardHeight > 0) setStickerPickerOpen(false)
  }, [keyboardHeight])

  const setNewestMessageId = (items: DirectMessage[]) => {
    const newest = items.length ? items[items.length - 1].id : 0
    newestMessageIdRef.current = newest
    if (newest) setScrollTarget(`direct-message-${newest}`)
  }

  const updateSelectedImage = useCallback((updater: (current: MediaImageDraft | null) => MediaImageDraft | null) => {
    setSelectedImage((current) => {
      const next = updater(current)
      selectedImageRef.current = next
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
  ) => {
    if (!image.mediaId || mediaReviewInFlightRef.current === operationVersion) return
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
              ? {
                ...current,
                status: 'uploading',
                progress: 100,
                error: '网络波动，正在继续审核',
              }
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
        },
      })
      if (!isCurrentImage() || result.kind === 'cancelled') return
      if (result.kind === 'passed') {
        resetImageRecoveryAction()
        updateSelectedImage((current) => current && current.key === image.key
          ? { ...current, status: 'uploaded', progress: 100, error: '' }
          : current)
        return
      }
      const reviewErrorMessage = result.kind === 'timeout'
        ? '图片审核超时，请重试'
        : result.media
          ? privateMessageMediaReviewMessage(result.media)
          : '图片审核未通过，请更换后重试'
      setImageRecoveryAction(result.media
        ? privateMessageMediaRetryAction(result.media.moderation_status)
        : 'retry-review')
      updateSelectedImage((current) => current && current.key === image.key
        ? { ...current, status: 'failed', error: reviewErrorMessage || '图片未通过审核，请更换后重试' }
        : current)
    } catch (reviewError) {
      if (!isCurrentImage()) return
      setImageRecoveryAction('retry-review')
      updateSelectedImage((current) => current && current.key === image.key
        ? {
          ...current,
          status: 'failed',
          error: imageErrorMessage(reviewError, '图片审核状态查询失败，请重试'),
        }
        : current)
    } finally {
      if (mediaReviewInFlightRef.current === operationVersion) {
        mediaReviewInFlightRef.current = 0
      }
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
        },
      })
      if (!isCurrentImage()) return
      uploadedMediaId = media.id
      updateSelectedImage((current) => current && current.key === image.key
        ? { ...current, mediaId: media.id, status: 'uploading', progress: 100, error: '' }
        : current)
      await submitPrivateMessageMediaReview(media.id)
      if (!isCurrentImage()) return
      await waitForSelectedImageReview({
        ...image,
        mediaId: media.id,
        status: 'uploading',
        progress: 100,
      }, operationVersion)
    } catch (uploadError) {
      if (!isCurrentImage()) return
      const canRetryReview = uploadedMediaId > 0
      setImageRecoveryAction(canRetryReview ? 'retry-review' : 'reupload')
      updateSelectedImage((current) => current && current.key === image.key
        ? {
          ...current,
          mediaId: canRetryReview ? uploadedMediaId : undefined,
          status: 'failed',
          error: imageErrorMessage(uploadError, '图片上传失败，请重试'),
        }
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
      await waitForSelectedImageReview({
        ...image,
        status: 'uploading',
        progress: 100,
        error: '',
      }, operationVersion)
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
    initialRequestVersion.current = version
    initialLoadingRef.current = true
    conversationIdRef.current = id
    setConversationId(id)
    setLoading(true)
    setError('')
    setMessages([])
    newestMessageIdRef.current = 0
    nextCursorRef.current = null
    hasMoreRef.current = true
    try {
      const [loadedConversation, page, identity] = await Promise.all([
        privateMessagesRepository.getConversation(id),
        privateMessagesRepository.listMessages(id, { pageSize: HISTORY_PAGE_SIZE }),
        getCurrentIdentity(),
      ])
      if (version !== initialRequestVersion.current) return
      const resolvedMessages = mergeDirectMessages([], page.items)
      const resolvedCursor = page.next_cursor || null
      setConversation(loadedConversation)
      setCurrentUserId(identity.user_id)
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
    const image = selectedImageRef.current
    if (image && image.mediaId && image.status === 'uploading') {
      void waitForSelectedImageReview(image, mediaOperationVersionRef.current)
    }
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
    const imageReady = selectedImage?.status === 'uploaded' && Boolean(selectedImage.mediaId)
    if ((!imageReady && !draft.trim()) || sending || !conversationId) return
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
    resetPendingSend()
    resetImageRecoveryAction()
    updateSelectedImage(() => null)
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

  const imageReady = selectedImage?.status === 'uploaded' && Boolean(selectedImage.mediaId)
  const canSend = Boolean(conversationId) && !sending && (imageReady || (!selectedImage && Boolean(draft.trim())))
  const pageClassName = [
    'direct-chat-page',
    stickerPickerOpen ? 'direct-chat-page--sticker-open' : '',
    selectedImage ? 'direct-chat-page--image-selected' : '',
  ].filter(Boolean).join(' ')

  return (
    <View className={pageClassName}>
      <CustomNavbar title={peerName} subtitle='私信' showBack />
      <ScrollView
        className='direct-chat-page__scroll'
        scrollY
        enhanced
        showScrollbar={false}
        upperThreshold={100}
        scrollIntoView={scrollTarget}
        onScrollToUpper={() => void loadHistory()}
      >
        <View className='direct-chat-page__content'>
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
              {messages.length === 0 && (
                <View className='direct-chat-empty'>
                  <Text>还没有消息</Text>
                  <Text>发一句问候，开始聊天吧</Text>
                </View>
              )}
              {messages.map((message) => {
                const isOwn = message.sender_id === currentUserId
                const image = message.image
                const imageFailed = image && failedImageMessageIds.includes(message.id)
                return (
                  <View
                    key={message.id}
                    id={`direct-message-${message.id}`}
                    className={isOwn ? 'direct-chat-message direct-chat-message--own' : 'direct-chat-message'}
                  >
                    {image && !imageFailed && (
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
                    {!image && (
                      <StickerContent
                        content={message.content}
                        className='direct-chat-message__content'
                        stickerClassName='direct-chat-message__sticker'
                      />
                    )}
                    <Text className='direct-chat-message__time'>{formatDateTime(message.created_at)}</Text>
                  </View>
                )
              })}
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
                maxlength={2000}
                placeholder='输入消息'
                placeholderClass='direct-chat-composer__placeholder'
                confirmType='send'
                keepVisibleOnKeyboard={false}
                onFocus={() => setStickerPickerOpen(false)}
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
            ariaLabel={selectedImage ? '已选择图片，请先发送或删除' : '选择图片'}
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
            {sending ? '发送中' : '发送'}
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
