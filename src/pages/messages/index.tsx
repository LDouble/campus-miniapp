import { useEffect, useMemo, useState } from 'react'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { ScrollView, Text, View } from '@tarojs/components'
import type { Notice } from '../../api/types'
import { isApiError } from '../../api/client'
import { requestWechatSubscriptionAndStopPropagation } from '../../features/wechat-subscription'
import CustomNavbar from '../../components/custom-navbar'
import { KeyboardSafeInput } from '../../components/keyboard-safe-input'
import { formatDateTime } from '../../features/life-services/format'
import { noticesRepository } from '../../features/notices/repository'
import { isQualificationEdition, type MigratedFeatureModule } from '../../features/app-edition'
import { featureMigratedUrl } from '../../features/app-edition/navigation'
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
  if (value.includes('comment') || value.includes('social') || value.includes('circle')) {
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

const actionRoute = (path: string) => {
  if (!path) return ''
  if (path.startsWith('/pages/')) return path
  const match = path.match(
    /^\/api\/v1\/(errands|marketplace\/listings|carpool\/trips|campus-circle\/posts)\/(\d+)/,
  )
  if (!match) return ''
  const id = match[2]
  if (match[1] === 'errands') return `/pages/errands/detail?id=${id}`
  if (match[1] === 'marketplace/listings') return `/pages/marketplace/detail?id=${id}`
  if (match[1] === 'carpool/trips') return `/pages/carpool/detail?id=${id}`
  return `/pages/community/detail?id=${id}&mode=post`
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
    void load()
  })

  usePullDownRefresh(() => {
    void load()
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
    const route = actionRoute(message.action_path)
    setActive(null)
    const migratedModule = migratedModuleForAction(message.action_path)
    if (isQualificationEdition && migratedModule) {
      Taro.navigateTo({
        url: featureMigratedUrl({ module: migratedModule, path: route || undefined }),
      })
      return
    }
    if (route) {
      Taro.navigateTo({ url: route })
      return
    }
    Taro.showToast({ title: '这条消息没有可跳转的页面', icon: 'none' })
  }

  return (
    <View className={`messages-page ${active ? 'messages-page--locked' : ''}`}>
      <CustomNavbar title='消息' subtitle={`${unreadCount} 条未读`} />
      <View className='messages-page__content'>
        <View className='messages-summary motion-enter'>
          <View><Text>校园消息</Text><Text>重要提醒，及时抵达</Text></View>
          <View
            className='motion-press'
            hoverClass='motion-press--active'
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
          {keyword && <Text onClick={() => setKeyword('')}>清除</Text>}
        </View>

        <View className='messages-tabs motion-enter motion-enter--delay-2'>
          {tabs.map((item) => (
            <View
              key={item}
              className={[
                'motion-press',
                tab === item ? 'messages-tabs__active' : '',
              ].filter(Boolean).join(' ')}
              hoverClass='motion-press--active'
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
            <View onClick={() => void load()}>重新加载</View>
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
              hoverClass='message-card--pressed'
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
              {actionRoute(active.action_path) && (
                <View
                  className='message-sheet__button message-sheet__button--primary motion-press'
                  hoverClass='motion-press--active'
                  onClick={() => goAction(active)}
                >
                  查看相关内容
                </View>
              )}
              <View
                className='message-sheet__button motion-press'
                hoverClass='motion-press--active'
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
