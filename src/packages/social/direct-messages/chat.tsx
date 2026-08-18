import { useCallback, useEffect, useRef, useState } from 'react'
import Taro, { useDidHide, useDidShow, useLoad, usePullDownRefresh } from '@tarojs/taro'
import { ScrollView, Text, View } from '@tarojs/components'
import { createIdempotencyKey, isApiError } from '../../../api/client'
import { getCurrentIdentity } from '../../../api/account'
import CustomNavbar from '../../../components/custom-navbar'
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
import { privateMessagesRepository } from '../../../features/direct-messages/repository'
import {
  decrementPrivateMessageUnreadCount,
  refreshPrivateMessageUnreadCount,
} from '../../../features/direct-messages/unread'
import type {
  DirectMessage,
  DirectMessageConversation,
} from '../../../features/direct-messages/types'
import './chat.scss'

const HISTORY_PAGE_SIZE = 50
const POLL_INTERVAL_MS = 4_000
const POLL_MAX_BACKOFF_MS = 30_000

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
  const pendingSendDraftRef = useRef('')

  const setNewestMessageId = (items: DirectMessage[]) => {
    const newest = items.length ? items[items.length - 1].id : 0
    newestMessageIdRef.current = newest
    if (newest) setScrollTarget(`direct-message-${newest}`)
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
      draft,
      pendingSendRef.current,
      pendingSendDraftRef.current,
      () => createIdempotencyKey(`private-message:${id}`),
    )
    if (!pending) return
    pendingSendRef.current = pending
    pendingSendDraftRef.current = draft
    setSending(true)
    try {
      const message = await privateMessagesRepository.sendMessage(
        id,
        pending.content,
        pending.idempotencyKey,
      )
      if (pendingSendRef.current === pending) {
        pendingSendRef.current = null
        pendingSendDraftRef.current = ''
        setDraft((current) => current === draft ? '' : current)
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
    if (pendingSendDraftRef.current !== value) {
      pendingSendRef.current = null
      pendingSendDraftRef.current = ''
    }
  }

  const peerName = conversation?.peer.deleted
    ? '已注销用户'
    : conversation?.peer.nickname || '私信'

  return (
    <View className='direct-chat-page'>
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
                return (
                  <View
                    key={message.id}
                    id={`direct-message-${message.id}`}
                    className={isOwn ? 'direct-chat-message direct-chat-message--own' : 'direct-chat-message'}
                  >
                    <Text className='direct-chat-message__content'>{message.content}</Text>
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
        <View className='direct-chat-composer__field'>
          <KeyboardSafeInput
            value={draft}
            maxlength={2000}
            placeholder='输入消息'
            confirmType='send'
            keepVisibleOnKeyboard={false}
            onKeyboardVisibilityChange={onKeyboardVisibilityChange}
            onInput={(event) => updateDraft(event.detail.value)}
            onConfirm={() => void send()}
          />
        </View>
        <View
          className={[
            'direct-chat-composer__send',
            !draft.trim() || sending || !conversationId ? 'direct-chat-composer__send--disabled' : '',
          ].filter(Boolean).join(' ')}
          hoverClass='direct-chat-composer__send--pressed'
          ariaRole='button'
          ariaLabel={sending
            ? '正在发送消息'
            : !draft.trim() || !conversationId ? '发送消息，当前不可用' : '发送消息'}
          onClick={() => void send()}
        >
          {sending ? '发送中' : '发送'}
        </View>
      </View>
    </View>
  )
}
