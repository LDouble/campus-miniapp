import { useRef, useState } from 'react'
import Taro, { useDidShow, usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import { isApiError } from '../../api/client'
import { isDevelopmentEnvironment } from '../../api/auth'
import CustomNavbar from '../../components/custom-navbar'
import UserAvatar from '../../components/user-avatar'
import { plainStickerContent } from '../../features/stickers/content'
import { formatMessageListTime } from '../../features/messages/time'
import { directMessageChatUrl } from '../../features/direct-messages/navigation'
import {
  canLoadDirectMessagePage,
  mergeDirectMessageConversations,
} from '../../features/direct-messages/pagination'
import { privateMessagesRepository } from '../../features/direct-messages/repository'
import { refreshPrivateMessageUnreadCount } from '../../features/direct-messages/unread'
import type { DirectMessageConversation } from '../../features/direct-messages/types'
import './index.scss'

const PAGE_SIZE = 20

const peerName = (conversation: DirectMessageConversation) => (
  conversation.peer.deleted ? '已注销用户' : conversation.peer.nickname
)

const preview = (conversation: DirectMessageConversation) => (
  conversation.last_message ? plainStickerContent(conversation.last_message.content) : '还没有消息，打个招呼吧'
)

export default function DirectMessagesPage() {
  const developmentPresentation = isDevelopmentEnvironment()
  const [conversations, setConversations] = useState<DirectMessageConversation[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const requestVersion = useRef(0)
  const loadingMoreRef = useRef(false)
  const nextCursorRef = useRef<string | null>(null)
  const hasMoreRef = useRef(true)
  const firstDidShow = useRef(true)
  const openedConversationIdRef = useRef(0)
  const conversationSyncRequest = useRef(0)

  const load = async (reset = true) => {
    if (!reset && !canLoadDirectMessagePage(
      loadingMoreRef.current,
      hasMoreRef.current,
      nextCursorRef.current,
    )) return

    const version = reset ? requestVersion.current + 1 : requestVersion.current
    if (reset) {
      requestVersion.current = version
      setLoading(true)
      setError('')
    } else {
      loadingMoreRef.current = true
      setLoadingMore(true)
    }

    try {
      const result = await privateMessagesRepository.listConversations({
        cursor: reset ? undefined : nextCursorRef.current || undefined,
        pageSize: PAGE_SIZE,
      })
      if (version !== requestVersion.current) return
      setConversations((current) => (
        reset ? result.items : mergeDirectMessageConversations(current, result.items)
      ))
      const resolvedCursor = result.next_cursor || null
      nextCursorRef.current = resolvedCursor
      hasMoreRef.current = result.has_more
      setNextCursor(resolvedCursor)
      setHasMore(result.has_more)
    } catch (loadError) {
      if (version === requestVersion.current) {
        setError(isApiError(loadError) ? loadError.message : '私信加载失败，请稍后重试')
      }
    } finally {
      if (!reset) {
        loadingMoreRef.current = false
        setLoadingMore(false)
      }
      if (version === requestVersion.current) setLoading(false)
      Taro.stopPullDownRefresh()
    }
  }

  const syncOpenedConversation = async () => {
    const conversationId = openedConversationIdRef.current
    if (!conversationId) return
    openedConversationIdRef.current = 0
    const requestId = ++conversationSyncRequest.current
    const listVersion = requestVersion.current
    try {
      const latest = await privateMessagesRepository.getConversation(conversationId)
      if (
        requestId !== conversationSyncRequest.current
        || listVersion !== requestVersion.current
      ) return
      // 只更新当前会话摘要，不重置列表、分页游标或滚动位置。
      setConversations((current) => current.map((item) => (
        item.id === latest.id ? latest : item
      )))
    } catch {
      // 返回列表时的摘要同步失败不影响已有列表，下拉刷新可重试。
    }
  }

  useDidShow(() => {
    if (firstDidShow.current) {
      firstDidShow.current = false
      void load(true)
    } else {
      void syncOpenedConversation()
    }
    void refreshPrivateMessageUnreadCount(true).catch(() => undefined)
  })

  usePullDownRefresh(() => {
    void Promise.all([
      load(true),
      refreshPrivateMessageUnreadCount(true),
    ]).catch(() => undefined).finally(() => Taro.stopPullDownRefresh())
  })

  useReachBottom(() => void load(false))

  const openConversation = (conversation: DirectMessageConversation) => {
    openedConversationIdRef.current = conversation.id
    void Taro.navigateTo({ url: directMessageChatUrl(conversation.id) })
  }

  return (
    <View className={[
      'direct-messages-page',
      developmentPresentation ? 'direct-messages-page--notice' : '',
    ].filter(Boolean).join(' ')}
    >
      <CustomNavbar title={developmentPresentation ? '通知' : '私信'} showBack />
      <View className='direct-messages-page__content'>
        {loading && (
          <View className='direct-messages-state'>正在加载会话</View>
        )}
        {!loading && error && conversations.length === 0 && (
          <View className='direct-messages-state direct-messages-state--error'>
            <Text>{error}</Text>
            <View ariaRole='button' ariaLabel='重新加载私信' onClick={() => void load(true)}>重新加载</View>
          </View>
        )}
        {!loading && !error && conversations.length === 0 && (
          <View className='direct-messages-state direct-messages-state--empty'>
            <Text>{developmentPresentation ? '还没有通知' : '还没有私信'}</Text>
            <Text>{developmentPresentation
              ? '暂无新的通知内容'
              : '在同学的个人主页点“发私信”开始聊天'}</Text>
          </View>
        )}
        {!loading && error && conversations.length > 0 && (
          <View className='direct-messages-inline-error'>{error}，当前展示上次结果</View>
        )}

        <View className='direct-conversation-list'>
          {conversations.map((conversation) => (
            <View
              key={conversation.id}
              className={[
                'direct-conversation-card',
                conversation.unread_count > 0 ? 'direct-conversation-card--unread' : '',
              ].filter(Boolean).join(' ')}
              ariaRole='button'
              ariaLabel={`${developmentPresentation ? '打开通知' : `打开与${peerName(conversation)}的私信`}${conversation.unread_count > 0 ? `，${conversation.unread_count} 条未读` : ''}`}
              onClick={() => openConversation(conversation)}
            >
              <UserAvatar
                src={conversation.peer.avatar_url}
                className='direct-conversation-card__avatar'
                imageClassName='direct-conversation-card__avatar-image'
                fallback={peerName(conversation).slice(0, 1) || '同'}
                shape='rounded'
                userId={conversation.peer.id}
              />
              <View className='direct-conversation-card__body'>
                <View className='direct-conversation-card__head'>
                  <Text>{peerName(conversation)}</Text>
                  <Text>{formatMessageListTime(conversation.last_activity_at)}</Text>
                </View>
                <Text>{preview(conversation)}</Text>
              </View>
              {conversation.unread_count > 0 && (
                <View className='direct-conversation-card__unread'>
                  {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
                </View>
              )}
            </View>
          ))}
        </View>

        {!loading && !error && loadingMore && <View className='direct-messages-footer'>正在加载更多会话</View>}
        {!loading && !error && conversations.length > 0 && !hasMore && (
          <View className='direct-messages-footer'>已经看完全部会话</View>
        )}
        {!loading && !error && conversations.length > 0 && hasMore && !loadingMore && !nextCursor && (
          <View className='direct-messages-footer'>继续下拉加载更多</View>
        )}
      </View>
    </View>
  )
}
