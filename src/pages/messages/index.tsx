import { useEffect, useMemo, useState } from 'react'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { Image, ScrollView, Text, View } from '@tarojs/components'
import type { Notice } from '../../api/types'
import { isApiError } from '../../api/client'
import { isDevelopmentEnvironment } from '../../api/auth'
import {
  requestWechatSubscriptionAndStopPropagation,
} from '../../features/wechat-subscription'
import CustomNavbar from '../../components/custom-navbar'
import { KeyboardSafeInput } from '../../components/keyboard-safe-input'
import UserAvatar from '../../components/user-avatar'
import { formatDateTime } from '../../features/life-services/format'
import { formatMessageListTime } from '../../features/messages/time'
import { noticesRepository } from '../../features/notices/repository'
import {
  isPrivateMessageNoticeAction,
  noticeActionRoute,
} from '../../features/notices/action-route'
import { isQualificationEdition, type MigratedFeatureModule } from '../../features/app-edition'
import { featureMigratedUrl } from '../../features/app-edition/navigation'
import {
  directMessageChatUrl,
  directMessagesListUrl,
} from '../../features/direct-messages/navigation'
import { privateMessagesRepository } from '../../features/direct-messages/repository'
import type { DirectMessageConversation } from '../../features/direct-messages/types'
import {
  refreshPrivateMessageUnreadCount,
} from '../../features/direct-messages/unread'
import { plainStickerContent } from '../../features/stickers/content'
import {
  getMiniappRuntimeConfig,
  loadMiniappRuntimeConfig,
  openMiniappModule,
  resolveMiniappModule,
} from '../../features/runtime-config'
import {
  setCustomTabBarHidden,
  setCustomTabBarUnreadCount,
  syncCustomTabBar,
} from '../../utils/tabbar'
import './index.scss'

type MessageType = '教务' | '互动' | '服务' | '系统'
type Tab = '全部' | MessageType
type MessageView = 'inbox' | 'notifications'

const tabs: Tab[] = ['全部', '教务', '互动', '服务', '系统']
const PRIVATE_PREVIEW_LIMIT = 4

const privatePeerName = (conversation: DirectMessageConversation) => (
  conversation.peer.deleted ? '已注销用户' : conversation.peer.nickname
)

const privateMessagePreview = (
  conversation: DirectMessageConversation,
  developmentPresentation = false,
) => (
  conversation.last_message
    ? plainStickerContent(conversation.last_message.content)
    : developmentPresentation ? '暂无新的通知内容' : '还没有消息，打个招呼吧'
)

const categoryType = (category: string): MessageType => {
  const value = category.toLowerCase()
  if (value.includes('academic') || value.includes('course') || value.includes('exam')) {
    return '教务'
  }
  if (
    value.includes('comment')
    || value.includes('social')
    || value.includes('circle')
    || value.includes('community')
  ) {
    return '互动'
  }
  if (
    value.includes('market')
    || value.includes('trade')
    || value.includes('errand')
    || value.includes('carpool')
  ) {
    return '服务'
  }
  return '系统'
}

const migratedModuleForAction = (path: string): MigratedFeatureModule | null => {
  if (/campus-circle|\/pages\/(community|publish)/.test(path)) return 'community'
  if (/marketplace|\/pages\/marketplace/.test(path)) return 'marketplace'
  if (/errands|\/pages\/errands/.test(path)) return 'errand'
  if (/carpool|\/pages\/carpool/.test(path)) return 'carpool'
  if (/materials|course-material/.test(path)) return 'course_materials'
  if (/clubs|club/.test(path)) return 'club'
  return null
}

export default function MessagesPage() {
  const developmentPresentation = isDevelopmentEnvironment()
  const [view, setView] = useState<MessageView>('inbox')
  const [messages, setMessages] = useState<Notice[]>([])
  const [tab, setTab] = useState<Tab>('全部')
  const [active, setActive] = useState<Notice | null>(null)
  const [keyword, setKeyword] = useState('')
  const [unreadIds, setUnreadIds] = useState<number[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [conversations, setConversations] = useState<DirectMessageConversation[]>([])
  const [privateReady, setPrivateReady] = useState(false)
  const [privateLoading, setPrivateLoading] = useState(false)
  const [privateError, setPrivateError] = useState('')
  const [privateHasMore, setPrivateHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [runtimeConfig, setRuntimeConfig] = useState(getMiniappRuntimeConfig)

  const updateUnreadCount = (count: number) => {
    const normalized = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0
    setUnreadCount(normalized)
    setCustomTabBarUnreadCount(normalized)
  }

  const loadPrivatePreview = async () => {
    setPrivateLoading(true)
    setPrivateError('')
    try {
      const result = await privateMessagesRepository.listConversations({
        pageSize: PRIVATE_PREVIEW_LIMIT,
      })
      setConversations(result.items.slice(0, PRIVATE_PREVIEW_LIMIT))
      setPrivateHasMore(result.has_more)
    } catch (loadError) {
      setPrivateError(isApiError(loadError) ? loadError.message : '私信加载失败，请稍后重试')
    } finally {
      setPrivateLoading(false)
    }
  }

  const refreshNoticeUnreadCount = async () => {
    try {
      const unread = await noticesRepository.unreadCount()
      updateUnreadCount(Number(unread.count))
    } catch {
      // 全局 onShow 已经负责同步 TabBar；页面入口保留当前数量即可。
    }
  }

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [page, unreadPage, unread] = await Promise.all([
        noticesRepository.list(),
        noticesRepository.list({ unread: true, pageSize: 100 }),
        noticesRepository.unreadCount(),
      ])
      setMessages(page.items)
      setUnreadIds(unreadPage.items.map((item) => item.id))
      updateUnreadCount(Number(unread.count))
    } catch (loadError) {
      setError(isApiError(loadError) ? loadError.message : '消息加载失败，请稍后重试')
    } finally {
      setLoading(false)
      Taro.stopPullDownRefresh()
    }
  }

  useDidShow(() => {
    setView('inbox')
    setPrivateReady(false)
    syncCustomTabBar('messages')
    void loadMiniappRuntimeConfig().then((config) => {
      setRuntimeConfig(config)
      const privateMessageEnabled = !isQualificationEdition
        && resolveMiniappModule(config, 'private_message').state === 'enabled'
      setPrivateReady(true)
      if (privateMessageEnabled) {
        void loadPrivatePreview()
        void refreshPrivateMessageUnreadCount(true).catch(() => undefined)
      } else {
        setConversations([])
        setPrivateError('')
        setPrivateLoading(false)
        setPrivateHasMore(false)
        void refreshPrivateMessageUnreadCount(true).catch(() => undefined)
      }
    })
    void refreshNoticeUnreadCount()
  })

  usePullDownRefresh(() => {
    if (view === 'notifications') {
      void load()
      return
    }
    const refreshTasks: Promise<unknown>[] = [refreshNoticeUnreadCount()]
    if (privateReady && resolveMiniappModule(runtimeConfig, 'private_message').state === 'enabled') {
      refreshTasks.push(
        loadPrivatePreview(),
        refreshPrivateMessageUnreadCount(true).catch(() => undefined),
      )
    }
    void Promise.all(refreshTasks).finally(() => Taro.stopPullDownRefresh())
  })

  useEffect(() => {
    setCustomTabBarHidden(Boolean(active))
    return () => setCustomTabBarHidden(false)
  }, [active])

  const visible = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()
    return messages.filter((item) => {
      const typeMatches = tab === '全部' || categoryType(item.category) === tab
      const keywordMatches = !normalized
        || item.title.toLowerCase().includes(normalized)
        || item.summary.toLowerCase().includes(normalized)
        || item.body.toLowerCase().includes(normalized)
      return typeMatches && keywordMatches
    })
  }, [keyword, messages, tab])

  const open = async (message: Notice) => {
    setActive(message)
    if (unreadIds.includes(message.id)) {
      setUnreadIds((current) => current.filter((id) => id !== message.id))
      updateUnreadCount(Math.max(0, unreadCount - 1))
      try {
        await noticesRepository.read(message.id)
      } catch {
        // 阅读状态可在下次进入时由服务端重新校准，不阻断消息查看。
      }
    }
  }

  const readAll = async () => {
    try {
      await noticesRepository.readAll()
      setUnreadIds([])
      updateUnreadCount(0)
    } catch (actionError) {
      Taro.showToast({
        title: isApiError(actionError) ? actionError.message : '操作失败',
        icon: 'none',
      })
    }
  }

  const goAction = (message: Notice) => {
    const route = noticeActionRoute(message.action_path, {
      allowPrivateMessages: !isQualificationEdition,
    })
    setActive(null)
    const migratedModule = migratedModuleForAction(message.action_path)
    if (isQualificationEdition && migratedModule) {
      Taro.navigateTo({
        url: featureMigratedUrl({ module: migratedModule, path: route || undefined }),
      })
      return
    }
    if (route && isPrivateMessageNoticeAction(route)) {
      void openMiniappModule('private_message', route, { config: runtimeConfig })
      return
    }
    if (route) {
      Taro.navigateTo({ url: route })
      return
    }
    Taro.showToast({ title: '这条消息没有可跳转的页面', icon: 'none' })
  }

  const openConversation = (conversation: DirectMessageConversation) => {
    void Taro.navigateTo({ url: directMessageChatUrl(conversation.id) })
  }

  const openPrivateMessages = () => {
    void openMiniappModule('private_message', directMessagesListUrl, {
      config: runtimeConfig,
    })
  }

  const openNotifications = () => {
    setView('notifications')
    void load()
  }

  const openInbox = () => {
    setView('inbox')
    if (privateReady && resolveMiniappModule(runtimeConfig, 'private_message').state === 'enabled') {
      void loadPrivatePreview()
    }
  }

  const canOpenNoticeAction = (message: Notice) => {
    const route = noticeActionRoute(message.action_path, {
      allowPrivateMessages: !isQualificationEdition,
    })
    return Boolean(route)
      && (!isPrivateMessageNoticeAction(route)
        || resolveMiniappModule(runtimeConfig, 'private_message').state !== 'hidden')
  }

  return (
    <View className={[
      'messages-page',
      developmentPresentation ? 'messages-page--notice' : '',
      active ? 'messages-page--locked' : '',
    ].filter(Boolean).join(' ')}
    >
      <CustomNavbar
        title={view === 'notifications' ? '校园通知' : '消息'}
        subtitle={view === 'notifications' && unreadCount > 0 ? `${unreadCount} 条未读` : undefined}
        showBack={view === 'notifications'}
        onBack={view === 'notifications' ? openInbox : undefined}
      />
      <View className='messages-page__content'>
        {view === 'inbox' ? (
          <View className='messages-inbox'>
            <View
              className='messages-notification-entry messages-notification-entry--pinned motion-enter'
              ariaRole='button'
              ariaLabel='打开校园通知'
              onClick={openNotifications}
            >
              <View className='messages-notification-entry__icon'>
                <Image src={require('../../assets/icons/service-notification.svg')} mode='aspectFit' />
              </View>
              <View className='messages-notification-entry__copy'>
                <Text>校园通知</Text>
                <Text>教务、互动与服务提醒</Text>
              </View>
              {unreadCount > 0 && (
                <Text className='messages-notification-entry__badge'>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              )}
              <Text className='messages-notification-entry__arrow'>›</Text>
            </View>

            {!isQualificationEdition
              && resolveMiniappModule(runtimeConfig, 'private_message').state === 'enabled'
              && (
              <>
                {!privateReady && (
                  <View className='messages-private-state'>
                    {developmentPresentation ? '正在准备通知' : '正在准备私信'}
                  </View>
                )}
                {privateReady && privateLoading && (
                  <View className='messages-private-state'>
                    {developmentPresentation ? '正在加载通知' : '正在加载私信'}
                  </View>
                )}
                {privateReady && !privateLoading && privateError && conversations.length === 0 && (
                  <View className='messages-private-state messages-private-state--error'>
                    <Text>{privateError}</Text>
                    <View
                      ariaRole='button'
                      ariaLabel={developmentPresentation ? '重新加载通知' : '重新加载私信'}
                      onClick={() => void loadPrivatePreview()}
                    >重试</View>
                  </View>
                )}
                {privateReady && !privateLoading && !privateError && conversations.length === 0 && (
                  <View className='messages-private-state messages-private-state--empty'>
                    <Text>{developmentPresentation ? '暂无新的通知' : '还没有私信'}</Text>
                    <Text>{developmentPresentation
                      ? '新的校园内容会显示在这里'
                      : '去同学主页发起聊天，最近会话会显示在这里'}</Text>
                  </View>
                )}
                {privateReady && !privateLoading && conversations.length > 0 && (
                  <>
                    <View className='messages-conversation-list'>
                      {conversations.map((conversation, index) => (
                        <View
                          key={conversation.id}
                          className={[
                            'messages-conversation-card',
                            'motion-enter',
                            `motion-enter--delay-${Math.min(index + 1, 4)}`,
                            conversation.unread_count > 0 ? 'messages-conversation-card--unread' : '',
                          ].filter(Boolean).join(' ')}
                          ariaRole='button'
                          ariaLabel={`${developmentPresentation ? '打开通知' : `打开与${privatePeerName(conversation)}的私信`}${conversation.unread_count > 0 ? `，${conversation.unread_count} 条未读` : ''}`}
                          onClick={() => openConversation(conversation)}
                        >
                          <UserAvatar
                            src={conversation.peer.avatar_url}
                            className='messages-conversation-card__avatar'
                            imageClassName='messages-conversation-card__avatar-image'
                            fallback={privatePeerName(conversation).slice(0, 1) || '同'}
                            shape='rounded'
                            userId={conversation.peer.id}
                          />
                          <View className='messages-conversation-card__body'>
                            <View className='messages-conversation-card__head'>
                              <Text>{privatePeerName(conversation)}</Text>
                              <Text>{formatMessageListTime(conversation.last_activity_at)}</Text>
                            </View>
                            <Text>{privateMessagePreview(conversation, developmentPresentation)}</Text>
                          </View>
                          {conversation.unread_count > 0 && (
                            <View className='messages-conversation-card__unread'>
                              {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
                            </View>
                          )}
                        </View>
                      ))}
                    </View>
                    {privateHasMore && (
                      <View
                        className='messages-private-more motion-press'
                        ariaRole='button'
                        ariaLabel={developmentPresentation ? '查看全部通知' : '查看全部私信'}
                        onClick={openPrivateMessages}
                      >
                        <Text>{developmentPresentation ? '查看全部通知' : '查看全部私信'}</Text>
                        <Text>›</Text>
                      </View>
                    )}
                  </>
                )}
              </>
            )}
          </View>
        ) : (
          <View className='messages-notifications'>
            <View className='messages-summary motion-enter'>
              <View><Text>校园通知</Text><Text>重要提醒，及时抵达</Text></View>
              <View
                className='motion-press'
                ariaRole='button'
                ariaLabel='将全部消息标记为已读'
                onClick={() => void readAll()}
              >
                全部已读
              </View>
            </View>

            <View className='messages-search motion-enter motion-enter--delay-1'>
              <View />
              <KeyboardSafeInput
                value={keyword}
                confirmType='search'
                maxlength={40}
                placeholder='搜索标题或消息内容'
                onInput={(event) => setKeyword(event.detail.value)}
              />
              {keyword && (
                <View
                  className='messages-search__clear'
                  ariaRole='button'
                  ariaLabel='清除搜索内容'
                  onClick={() => setKeyword('')}
                >清除</View>
              )}
            </View>

            <View className='messages-tabs motion-enter motion-enter--delay-2'>
              {tabs.map((item) => (
                <View
                  key={item}
                  className={[
                    'motion-press',
                    tab === item ? 'messages-tabs__active' : '',
                  ].filter(Boolean).join(' ')}
                  ariaRole='button'
                  ariaLabel={`筛选${item}消息`}
                  onClick={() => setTab(item)}
                >
                  {item}
                </View>
              ))}
            </View>

            {loading && <View className='messages-state'>正在加载消息</View>}
            {!loading && error && (
              <View className='messages-state messages-state--error'>
                <Text>{error}</Text>
                <View className='messages-state__retry' ariaRole='button' ariaLabel='重新加载消息' onClick={() => void load()}>重新加载</View>
              </View>
            )}

            {!loading && !error && visible.map((message, index) => {
              const type = categoryType(message.category)
              const unread = unreadIds.includes(message.id)
              const iconTone = type === '教务'
                ? 'academic'
                : type === '互动'
                  ? 'social'
                  : type === '服务'
                    ? 'trade'
                    : 'system'
              return (
                <View
                  key={message.id}
                  className={[
                    'message-card',
                    'motion-enter',
                    `motion-enter--delay-${Math.min(index + 1, 4)}`,
                    unread ? 'message-card--unread' : '',
                  ].filter(Boolean).join(' ')}
                  ariaRole='button'
                  ariaLabel={`查看${message.title}`}
                  onClick={() => void open(message)}
                >
                  <View className={`message-card__icon message-card__icon--${iconTone}`}>
                    {type.slice(0, 1)}
                  </View>
                  <View className='message-card__body'>
                    <View>
                      <Text>{message.title}</Text>
                      <Text>{formatMessageListTime(message.published_at || message.created_at)}</Text>
                    </View>
                    <Text>{message.summary || message.body}</Text>
                  </View>
                  {unread && <View className='message-card__dot' />}
                </View>
              )
            })}

            {!loading && !error && visible.length === 0 && (
              <View className='messages-empty'>
                <View />
                <Text>{keyword ? '没有找到相关消息' : '暂时没有消息'}</Text>
                <Text>{keyword ? '换个关键词试试吧' : '新的校园消息会出现在这里'}</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {active && (
        <View className='message-overlay' onClick={() => setActive(null)}>
          <View className='message-sheet' onClick={requestWechatSubscriptionAndStopPropagation}>
            <View className='message-sheet__handle' />
            <ScrollView
              className='message-sheet__scroll'
              scrollY
              enhanced
              showScrollbar={false}
            >
              <View className='message-sheet__scroll-content'>
                <Text className='message-sheet__type'>
                  {categoryType(active.category)}消息
                </Text>
                <Text className='message-sheet__title'>{active.title}</Text>
                <Text className='message-sheet__time'>
                  {formatDateTime(active.published_at || active.created_at)}
                </Text>
                <Text className='message-sheet__content'>{active.body}</Text>
              </View>
            </ScrollView>
            <View className='message-sheet__actions'>
              {canOpenNoticeAction(active) && (
                <View
                  className='message-sheet__button message-sheet__button--primary motion-press'
                  ariaRole='button'
                  ariaLabel='查看相关内容'
                  onClick={() => goAction(active)}
                >
                  查看相关内容
                </View>
              )}
              <View
                className='message-sheet__button motion-press'
                ariaRole='button'
                ariaLabel='关闭消息详情'
                onClick={() => setActive(null)}
              >
                知道了
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
