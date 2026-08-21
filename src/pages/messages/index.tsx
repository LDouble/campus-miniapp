import { useEffect, useMemo, useState } from 'react'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { Image, ScrollView, Text, View } from '@tarojs/components'
import type { Notice } from '../../api/types'
import { isApiError } from '../../api/client'
import {
  requestWechatSubscriptionAndStopPropagation,
} from '../../features/wechat-subscription'
import CustomNavbar from '../../components/custom-navbar'
import { KeyboardSafeInput } from '../../components/keyboard-safe-input'
import { formatDateTime } from '../../features/life-services/format'
import { noticesRepository } from '../../features/notices/repository'
import {
  isPrivateMessageNoticeAction,
  noticeActionRoute,
} from '../../features/notices/action-route'
import { isQualificationEdition, type MigratedFeatureModule } from '../../features/app-edition'
import { featureMigratedUrl } from '../../features/app-edition/navigation'
import { directMessagesListUrl } from '../../features/direct-messages/navigation'
import {
  refreshPrivateMessageUnreadCount,
  subscribePrivateMessageUnreadCount,
} from '../../features/direct-messages/unread'
import {
  getMiniappRuntimeConfig,
  loadMiniappRuntimeConfig,
  openMiniappModule,
  resolveMiniappModule,
} from '../../features/runtime-config'
import { setCustomTabBarHidden, syncCustomTabBar } from '../../utils/tabbar'
import './index.scss'

type MessageType = '教务' | '互动' | '服务' | '系统'
type Tab = '全部' | MessageType

const tabs: Tab[] = ['全部', '教务', '互动', '服务', '系统']
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
  const [messages, setMessages] = useState<Notice[]>([])
  const [tab, setTab] = useState<Tab>('全部')
  const [active, setActive] = useState<Notice | null>(null)
  const [keyword, setKeyword] = useState('')
  const [unreadIds, setUnreadIds] = useState<number[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [privateUnreadCount, setPrivateUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [runtimeConfig, setRuntimeConfig] = useState(getMiniappRuntimeConfig)

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
      setUnreadCount(Number(unread.count))
    } catch (loadError) {
      setError(isApiError(loadError) ? loadError.message : '消息加载失败，请稍后重试')
    } finally {
      setLoading(false)
      Taro.stopPullDownRefresh()
    }
  }

  useDidShow(() => {
    syncCustomTabBar('messages')
    void loadMiniappRuntimeConfig().then((config) => {
      setRuntimeConfig(config)
      if (resolveMiniappModule(config, 'private_message').state === 'enabled') {
        void refreshPrivateMessageUnreadCount(true).catch(() => undefined)
      }
    })
    void load()
  })

  usePullDownRefresh(() => {
    void load()
  })

  useEffect(() => {
    setCustomTabBarHidden(Boolean(active))
    return () => setCustomTabBarHidden(false)
  }, [active])

  useEffect(() => subscribePrivateMessageUnreadCount(setPrivateUnreadCount), [])

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
      setUnreadCount((current) => Math.max(0, current - 1))
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
      setUnreadCount(0)
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

  const openPrivateMessages = () => {
    void openMiniappModule('private_message', directMessagesListUrl, {
      config: runtimeConfig,
    })
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
    <View className={`messages-page ${active ? 'messages-page--locked' : ''}`}>
      <CustomNavbar title='消息' subtitle={`${unreadCount} 条未读`} />
      <View className='messages-page__content'>
        {!isQualificationEdition
          && resolveMiniappModule(runtimeConfig, 'private_message').state !== 'hidden'
          && (
          <View
            className='messages-private-entry motion-enter'
            ariaRole='button'
            ariaLabel='打开私信'
            onClick={openPrivateMessages}
          >
            <View className='messages-private-entry__icon'>
              <Image src={require('../../assets/icons/message.svg')} mode='aspectFit' />
            </View>
            <View className='messages-private-entry__copy'>
              <Text>私信</Text>
              <Text>和同学聊聊，消息只在会话中展示</Text>
            </View>
            {privateUnreadCount > 0 && (
              <View className='messages-private-entry__badge'>
                {privateUnreadCount > 99 ? '99+' : privateUnreadCount}
              </View>
            )}
            <Text className='messages-private-entry__arrow'>查看</Text>
          </View>
        )}
        <View className='messages-summary motion-enter'>
          <View><Text>校园消息</Text><Text>重要提醒，及时抵达</Text></View>
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
                  <Text>{formatDateTime(message.published_at || message.created_at)}</Text>
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
