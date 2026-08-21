import { useEffect, useRef, useState } from 'react'
import Taro, { useDidShow, usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import { isApiError } from '../../../api/client'
import CustomNavbar from '../../../components/custom-navbar'
import UserAvatarImage from '../../../components/user-avatar-image'
import { plainStickerContent } from '../../../features/stickers/content'
import { formatDateTime } from '../../../features/life-services/format'
import { directMessageChatUrl } from '../../../features/direct-messages/navigation'
import {
  canLoadDirectMessagePage,
  mergeDirectMessageConversations,
} from '../../../features/direct-messages/pagination'
import { privateMessagesRepository } from '../../../features/direct-messages/repository'
import {
  refreshPrivateMessageUnreadCount,
  subscribePrivateMessageUnreadCount,
} from '../../../features/direct-messages/unread'
import type { DirectMessageConversation } from '../../../features/direct-messages/types'
import './index.scss'

const PAGE_SIZE = 20

const peerName = (conversation: DirectMessageConversation) => (
  conversation.peer.deleted ? '已注销用户' : conversation.peer.nickname
)

const preview = (conversation: DirectMessageConversation) => (
  conversation.last_message ? plainStickerContent(conversation.last_message.content) : '还没有消息，打个招呼吧'
)

export default function DirectMessagesPage() {
  const [conversations, setConversations] = useState<DirectMessageConversation[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const requestVersion = useRef(0)
  const loadingMoreRef = useRef(false)
  const nextCursorRef = useRef<string | null>(null)
  const hasMoreRef = useRef(true)

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

  useDidShow(() => {
    void load(true)
    void refreshPrivateMessageUnreadCount(true).catch(() => undefined)
  })

  usePullDownRefresh(() => {
    void Promise.all([
      load(true),
      refreshPrivateMessageUnreadCount(true),
    ]).catch(() => undefined).finally(() => Taro.stopPullDownRefresh())
  })

  useReachBottom(() => void load(false))

  useEffect(() => subscribePrivateMessageUnreadCount(setUnreadCount), [])

  const openConversation = (conversation: DirectMessageConversation) => {
    void Taro.navigateTo({ url: directMessageChatUrl(conversation.id) })
  }

  return (
    <View className='direct-messages-page'>
      <CustomNavbar title='私信' subtitle={unreadCount > 0 ? `${unreadCount} 条未读` : '和同学聊聊'} showBack />
      <View className='direct-messages-page__content'>
        <View className='direct-messages-intro motion-enter'>
          <View>
            <Text>校园私信</Text>
            <Text>支持文字、图片和表情，请文明交流</Text>
          </View>
          {unreadCount > 0 && <Text>{unreadCount > 99 ? '99+' : unreadCount} 未读</Text>}
        </View>

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
            <Text>还没有私信</Text>
            <Text>在同学的个人主页点“发私信”开始聊天</Text>
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
              ariaLabel={`打开与${peerName(conversation)}的私信${conversation.unread_count > 0 ? `，${conversation.unread_count} 条未读` : ''}`}
              onClick={() => openConversation(conversation)}
            >
              <View className='direct-conversation-card__avatar'>
                <UserAvatarImage
                  src={conversation.peer.avatar_url}
                  className='direct-conversation-card__avatar-image'
                  fallback={peerName(conversation).slice(0, 1) || '同'}
                  lazyLoad
                />
              </View>
              <View className='direct-conversation-card__body'>
                <View className='direct-conversation-card__head'>
                  <Text>{peerName(conversation)}</Text>
                  <Text>{formatDateTime(conversation.last_activity_at)}</Text>
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
