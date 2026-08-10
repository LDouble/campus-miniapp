import { useEffect, useRef, useState } from 'react'
import Taro, { useLoad, usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { ScrollView, Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import { KeyboardSafeInput } from '../../components/keyboard-safe-input'
import { isApiError } from '../../api/client'
import { officialNoticesRepository } from '../../features/official-notices/repository'
import {
  canLoadOfficialNoticeFeed,
  mergeOfficialNoticeFeed,
} from '../../features/official-notices/feed'
import {
  formatOfficialNoticeDate,
  officialNoticeCategoryLabels,
  officialNoticeSourceLabels,
} from '../../features/official-notices/types'
import type {
  OfficialNotice,
  OfficialNoticeCategory,
  OfficialNoticeSource,
} from '../../features/official-notices/types'
import { takeWechatAiHandoffQuery } from '../../features/wechat-ai/handoff'
import './index.scss'

const PAGE_SIZE = 15
const sources: Array<{ label: string; value?: OfficialNoticeSource }> = [
  { label: '全部' },
  ...Object.entries(officialNoticeSourceLabels).map(([value, label]) => ({
    label,
    value: value as OfficialNoticeSource,
  })),
]
const categoryOptions: Array<{ label: string; value?: OfficialNoticeCategory }> = [
  { label: '全部分类' },
  ...Object.entries(officialNoticeCategoryLabels).map(([value, label]) => ({
    label,
    value: value as OfficialNoticeCategory,
  })),
]
const timeOptions = [
  { label: '全部时间', days: 0 },
  { label: '最近 7 天', days: 7 },
  { label: '最近 30 天', days: 30 },
  { label: '最近 90 天', days: 90 },
]

const validKeyword = (value?: string) => {
  const normalized = value?.trim() || ''
  return normalized && normalized.length <= 100 ? normalized : undefined
}

const validSource = (value?: string): OfficialNoticeSource | undefined => (
  value && Object.prototype.hasOwnProperty.call(officialNoticeSourceLabels, value)
    ? value as OfficialNoticeSource
    : undefined
)

const validCategory = (value?: string): OfficialNoticeCategory | undefined => (
  value && Object.prototype.hasOwnProperty.call(officialNoticeCategoryLabels, value)
    ? value as OfficialNoticeCategory
    : undefined
)

const handoffTimeIndex = (value?: string) => {
  const days = Number(value)
  return timeOptions.findIndex((item) => item.days === days)
}

export default function OfficialNoticesPage() {
  const [items, setItems] = useState<OfficialNotice[]>([])
  const [query, setQuery] = useState('')
  const [keyword, setKeyword] = useState('')
  const [source, setSource] = useState<OfficialNoticeSource | undefined>()
  const [category, setCategory] = useState<OfficialNoticeCategory | undefined>()
  const [timeIndex, setTimeIndex] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const requestVersion = useRef(0)
  const resetRequestVersion = useRef(0)
  const loadingMoreRef = useRef(false)
  const handoffLoadStarted = useRef(false)

  const publishedSince = (index = timeIndex) => {
    const days = timeOptions[index]?.days || 0
    return days ? new Date(Date.now() - days * 86_400_000).toISOString() : undefined
  }

  const load = async (
    reset = true,
    nextKeyword = keyword,
    nextSource = source,
    nextCategory = category,
    nextTimeIndex = timeIndex,
  ) => {
    const feedBusy = loadingMoreRef.current || resetRequestVersion.current !== 0
    if (!reset && !canLoadOfficialNoticeFeed(feedBusy, hasMore, nextCursor)) return
    const version = reset ? requestVersion.current + 1 : requestVersion.current
    if (reset) {
      requestVersion.current = version
      resetRequestVersion.current = version
      setNextCursor(null)
      setHasMore(true)
      setLoading(true)
      setError('')
    } else {
      loadingMoreRef.current = true
      setLoadingMore(true)
    }
    try {
      const result = await officialNoticesRepository.feed({
        keyword: nextKeyword,
        source: nextSource,
        category: nextCategory,
        publishedSince: publishedSince(nextTimeIndex),
        cursor: reset ? undefined : nextCursor || undefined,
        pageSize: PAGE_SIZE,
      })
      if (requestVersion.current !== version) return
      setItems((current) => reset ? result.items : mergeOfficialNoticeFeed(current, result.items))
      setNextCursor(result.next_cursor)
      setHasMore(result.has_more)
    } catch (loadError) {
      if (requestVersion.current === version) {
        setError(isApiError(loadError) ? loadError.message : '通知加载失败，请稍后重试')
      }
    } finally {
      if (!reset) {
        loadingMoreRef.current = false
        setLoadingMore(false)
      }
      if (requestVersion.current === version) {
        if (resetRequestVersion.current === version) resetRequestVersion.current = 0
        setLoading(false)
      }
      Taro.stopPullDownRefresh()
    }
  }

  useLoad((options) => {
    const handoffQuery = takeWechatAiHandoffQuery(options, 'pages/official-notices/index')
    const nextKeyword = validKeyword(handoffQuery.keyword)
    const nextSource = validSource(handoffQuery.source)
    const nextCategory = validCategory(handoffQuery.category)
    const nextTimeIndex = handoffTimeIndex(handoffQuery.days)
    if (!nextKeyword && !nextSource && !nextCategory && nextTimeIndex < 0) return
    handoffLoadStarted.current = true
    const resolvedKeyword = nextKeyword || ''
    const resolvedTimeIndex = nextTimeIndex >= 0 ? nextTimeIndex : 0
    setQuery(resolvedKeyword)
    setKeyword(resolvedKeyword)
    setSource(nextSource)
    setCategory(nextCategory)
    setTimeIndex(resolvedTimeIndex)
    void load(true, resolvedKeyword, nextSource, nextCategory, resolvedTimeIndex)
  })

  useEffect(() => {
    const timer = setTimeout(() => {
      const nextKeyword = query.trim()
      if (nextKeyword === keyword) return
      setKeyword(nextKeyword)
      void load(true, nextKeyword)
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  useEffect(() => {
    if (!handoffLoadStarted.current) void load(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  usePullDownRefresh(() => void load(true))
  useReachBottom(() => void load(false))

  const chooseSource = (next?: OfficialNoticeSource) => {
    setSource(next)
    void load(true, keyword, next)
  }

  const chooseCategory = async () => {
    const result = await Taro.showActionSheet({ itemList: categoryOptions.map((item) => item.label) })
    const next = categoryOptions[result.tapIndex]?.value
    setCategory(next)
    void load(true, keyword, source, next)
  }

  const chooseTime = async () => {
    const result = await Taro.showActionSheet({ itemList: timeOptions.map((item) => item.label) })
    const next = result.tapIndex
    setTimeIndex(next)
    void load(true, keyword, source, category, next)
  }

  const openDetail = (item: OfficialNotice) => {
    void Taro.navigateTo({ url: `/pages/official-notices/detail?id=${item.id}` })
  }

  return (
    <View className='official-notices-page'>
      <CustomNavbar title='全校通知' subtitle='学校权威信息，一处查看' showBack />
      <View className='official-notices-search'>
        <View className='official-notices-search__icon' />
        <KeyboardSafeInput
          value={query}
          placeholder='搜索通知标题、摘要或发布单位'
          confirmType='search'
          onInput={(event) => setQuery(event.detail.value)}
          onConfirm={() => {
            const nextKeyword = query.trim()
            setKeyword(nextKeyword)
            void load(true, nextKeyword)
          }}
        />
        {!!query && <Text onClick={() => setQuery('')}>清除</Text>}
      </View>

      <ScrollView className='official-notices-sources' scrollX enhanced showScrollbar={false}>
        <View className='official-notices-sources__inner'>
          {sources.map((item) => (
            <View
              key={item.value || 'all'}
              className={source === item.value ? 'is-active' : ''}
              onClick={() => chooseSource(item.value)}
            >{item.label}</View>
          ))}
        </View>
      </ScrollView>

      <View className='official-notices-filters'>
        <View onClick={() => void chooseCategory()}>
          {category ? officialNoticeCategoryLabels[category] : '全部分类'} <Text>⌄</Text>
        </View>
        <View onClick={() => void chooseTime()}>
          {timeOptions[timeIndex].label} <Text>⌄</Text>
        </View>
        <Text>{hasMore ? `已加载 ${items.length} 条` : `${items.length} 条通知`}</Text>
      </View>

      {loading && (
        <View className='official-notices-state'>正在加载通知…</View>
      )}
      {!loading && error && (
        <View className='official-notices-state'>
          <Text>{error}</Text>
          <View onClick={() => void load(true)}>重新加载</View>
        </View>
      )}
      {!loading && !error && items.length === 0 && (
        <View className='official-notices-state'>
          <Text>没有找到符合条件的通知</Text>
          <Text>换个关键词或筛选条件试试</Text>
        </View>
      )}
      {!loading && !error && items.map((item) => (
        <View
          key={item.id}
          className={`official-notice-card ${item.priority === 'important' ? 'official-notice-card--important' : ''}`}
          hoverClass='official-notice-card--pressed'
          onClick={() => openDetail(item)}
        >
          <View className='official-notice-card__meta'>
            <View>{officialNoticeSourceLabels[item.source]}</View>
            <Text>{officialNoticeCategoryLabels[item.category]}</Text>
            <Text>{formatOfficialNoticeDate(item.source_published_at)}</Text>
          </View>
          <Text className='official-notice-card__title'>{item.title}</Text>
          <Text className='official-notice-card__summary'>{item.summary}</Text>
          <View className='official-notice-card__footer'>
            <Text>{item.publisher}</Text>
            <Text>查看全文 ›</Text>
          </View>
        </View>
      ))}
      {loadingMore && <View className='official-notices-more'>正在加载更多…</View>}
      {!loading && items.length > 0 && !hasMore && (
        <View className='official-notices-more'>已展示全部通知</View>
      )}
    </View>
  )
}
