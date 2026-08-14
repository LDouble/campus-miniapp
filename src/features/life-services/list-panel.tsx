import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Text, View } from '@tarojs/components'
import type {
  CarpoolTripView,
  ErrandView,
  MarketplaceListingView,
} from '../../api/types'
import { isApiError } from '../../api/client'
import { KeyboardSafeInput } from '../../components/keyboard-safe-input'
import { apiDateTimeCampusParts } from '../../utils/date-time'
import { lifeBusinessThemes } from './business-theme'
import type { LifeHubSection } from './business-theme'
import {
  openCourseMarketplacePublisher,
  type MarketplaceSearchPrefill,
} from './marketplace-prefill'
import { lifeServicesRepository } from './repository'
import {
  getLifeHubRefreshRevision,
  isLifeHubCacheReusable,
  markLifeHubSectionFresh,
} from './refresh-policy'
import CarpoolCard from './components/carpool-card'
import CarpoolFilters, {
  type CarpoolFilterValue,
} from './components/carpool-filters'
import ErrandCard from './components/errand-card'
import MarketplaceCard from './components/marketplace-card'
import MarketplaceFilters, {
  type MarketplaceFilterValue,
} from './components/marketplace-filters'
import './list-panel.scss'

export type LifeServiceSection = Exclude<LifeHubSection, 'community'>
type ServiceItem = ErrandView | MarketplaceListingView | CarpoolTripView
type LifeServiceCacheEntry = {
  items: ServiceItem[]
  page: number
  total: number
  refreshedAt: number
  revision: number
}

const lifeServiceCache = new Map<string, LifeServiceCacheEntry>()
const LIFE_SERVICE_CACHE_LIMIT = 24

const saveLifeServiceCache = (key: string, entry: LifeServiceCacheEntry) => {
  lifeServiceCache.delete(key)
  lifeServiceCache.set(key, entry)
  if (lifeServiceCache.size <= LIFE_SERVICE_CACHE_LIMIT) return
  const oldestKey = lifeServiceCache.keys().next().value
  if (oldestKey) lifeServiceCache.delete(oldestKey)
}

type Props = {
  section: LifeServiceSection
  refreshSignal?: number
  searchFocusSignal?: number
  marketplaceSearchPrefill?: MarketplaceSearchPrefill | null
  onMarketplaceSearchPrefillConsumed?: () => void
}

const mergeUniqueItems = (current: ServiceItem[], incoming: ServiceItem[]) => {
  const byId = new Map(current.map((item) => [item.id, item]))
  incoming.forEach((item) => byId.set(item.id, item))
  return [...byId.values()]
}

const dateKey = (value?: string | null) => {
  if (!value) return 'unknown'
  const parts = apiDateTimeCampusParts(value)
  return parts ? parts.date : value.slice(0, 10)
}

const dateGroupLabel = (key: string) => {
  if (key === 'unknown') return '时间待确认'
  const today = new Date()
  const tomorrow = new Date()
  tomorrow.setDate(today.getDate() + 1)
  const localKey = (date: Date) => (
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  )
  if (key === localKey(today)) return '今天出发'
  if (key === localKey(tomorrow)) return '明天出发'
  return `${key.replace(/-/g, '.')} 出发`
}

const emptyCopy: Record<LifeServiceSection, { title: string; subtitle: string }> = {
  errands: {
    title: '暂时没有待接任务',
    subtitle: '稍后再来看看，或发布一个新的跑腿任务',
  },
  market: {
    title: '没有找到合适的闲置',
    subtitle: '试试调整关键词或价格范围',
  },
  carpool: {
    title: '没有匹配的同行计划',
    subtitle: '调整日期、路线或人数后再试试',
  },
}

export default function LifeServiceListPanel({
  section,
  refreshSignal = 0,
  searchFocusSignal = 0,
  marketplaceSearchPrefill = null,
  onMarketplaceSearchPrefillConsumed,
}: Props) {
  const [draftKeyword, setDraftKeyword] = useState('')
  const [keyword, setKeyword] = useState('')
  const [marketFilters, setMarketFilters] = useState<MarketplaceFilterValue>({})
  const [carpoolFilters, setCarpoolFilters] = useState<CarpoolFilterValue>({})
  const [items, setItems] = useState<ServiceItem[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [courseSearch, setCourseSearch] = useState<MarketplaceSearchPrefill | null>(null)
  const requestSequence = useRef(0)
  const copy = lifeBusinessThemes[section]
  const queryKey = useMemo(() => JSON.stringify({
    section,
    keyword,
    marketFilters,
    carpoolFilters,
  }), [carpoolFilters, keyword, marketFilters, section])

  const load = useCallback(async (nextPage = 1, append = false) => {
    const requestId = ++requestSequence.current
    append ? setLoadingMore(true) : setLoading(true)
    setError('')
    try {
      const result = section === 'errands'
        ? await lifeServicesRepository.listErrands({ keyword, page: nextPage })
        : section === 'market'
          ? await lifeServicesRepository.listMarketplace({
            keyword,
            intent: marketFilters.intent,
            category: marketFilters.category,
            minPriceCents: marketFilters.minPriceCents,
            maxPriceCents: marketFilters.maxPriceCents,
            page: nextPage,
          })
          : await lifeServicesRepository.listCarpool({
            keyword,
            origin: carpoolFilters.origin,
            destination: carpoolFilters.destination,
            departureDate: carpoolFilters.departureDate,
            seatsNeeded: carpoolFilters.seatsNeeded,
            page: nextPage,
          })
      if (requestId !== requestSequence.current) return
      const refreshedAt = Date.now()
      const revision = getLifeHubRefreshRevision(section)
      setItems((current) => {
        const nextItems = append
          ? mergeUniqueItems(current, result.items)
          : result.items
        saveLifeServiceCache(queryKey, {
          items: nextItems,
          page: result.page,
          total: Number(result.total),
          refreshedAt,
          revision,
        })
        return nextItems
      })
      setPage(result.page)
      setTotal(Number(result.total))
      markLifeHubSectionFresh(section, refreshedAt)
    } catch (loadError) {
      if (requestId !== requestSequence.current) return
      setError(isApiError(loadError)
        ? loadError.message
        : '没有连接到校园服务，请稍后重试')
    } finally {
      if (requestId === requestSequence.current) {
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }, [
    carpoolFilters.departureDate,
    carpoolFilters.destination,
    carpoolFilters.origin,
    carpoolFilters.seatsNeeded,
    keyword,
    marketFilters.category,
    marketFilters.intent,
    marketFilters.maxPriceCents,
    marketFilters.minPriceCents,
    queryKey,
    section,
  ])

  useEffect(() => {
    setDraftKeyword('')
    setKeyword('')
    setItems([])
  }, [section])

  useEffect(() => {
    const cached = lifeServiceCache.get(queryKey)
    if (
      cached
      && isLifeHubCacheReusable(
        section,
        cached.revision,
        cached.refreshedAt,
      )
    ) {
      setItems(cached.items)
      setPage(cached.page)
      setTotal(cached.total)
      setError('')
      setLoading(false)
      markLifeHubSectionFresh(section, cached.refreshedAt)
      return
    }
    void load(1, false)
  }, [load, queryKey, refreshSignal, section])

  useEffect(() => {
    if (searchFocusSignal > 0) setSearchFocused(true)
  }, [searchFocusSignal])

  useEffect(() => {
    if (section !== 'market' || !marketplaceSearchPrefill) return
    setCourseSearch(marketplaceSearchPrefill)
    setDraftKeyword(marketplaceSearchPrefill.courseName)
    setKeyword(marketplaceSearchPrefill.courseName)
    setMarketFilters({
      intent: 'sell',
      category: 'course_material',
    })
    setItems([])
    onMarketplaceSearchPrefillConsumed?.()
  }, [
    marketplaceSearchPrefill,
    onMarketplaceSearchPrefillConsumed,
    section,
  ])

  const canLoadMore = items.length < total
  const hasStructuredFilters = section === 'market'
    ? marketFilters.intent !== undefined
      || marketFilters.category !== undefined
      || marketFilters.minPriceCents !== undefined
      || marketFilters.maxPriceCents !== undefined
    : section === 'carpool'
      ? Object.values(carpoolFilters).some(
        (value) => value !== undefined && value !== '',
      )
      : false

  const resultTitle = courseSearch
    ? `《${courseSearch.courseName}》相关资料`
    : keyword
      ? `“${keyword}”`
    : section === 'errands'
      ? '全校待接任务'
      : section === 'market'
        ? marketFilters.intent === 'wanted' ? '最新求购' : marketFilters.intent === 'sell' ? '最新出售' : '最新交易'
        : '近期同行'

  const carpoolGroups = useMemo(() => {
    if (section !== 'carpool') return []
    const groups = new Map<string, CarpoolTripView[]>()
    ;(items as CarpoolTripView[]).forEach((item) => {
      const key = dateKey(item.departure_at)
      groups.set(key, [...(groups.get(key) || []), item])
    })
    return [...groups.entries()].map(([key, trips]) => ({
      key,
      label: dateGroupLabel(key),
      trips,
    }))
  }, [items, section])

  const submitSearch = () => {
    const nextKeyword = draftKeyword.trim()
    if (courseSearch && nextKeyword !== courseSearch.courseName.trim()) {
      setCourseSearch(null)
    }
    setKeyword(nextKeyword)
  }
  const clearAll = () => {
    setCourseSearch(null)
    setDraftKeyword('')
    setKeyword('')
    if (section === 'market') setMarketFilters({})
    if (section === 'carpool') setCarpoolFilters({})
  }

  return (
    <View className={`life-panel life-panel--${section}`}>
      <View className={`life-search life-search--${section}`}>
        <View className='life-search__icon' />
        <KeyboardSafeInput
          id={`life-search-input-${section}`}
          value={draftKeyword}
          focus={searchFocused}
          confirmType='search'
          maxlength={40}
          placeholder={copy.searchHint}
          placeholderClass='life-search__placeholder'
          onInput={(event) => setDraftKeyword(event.detail.value)}
          onConfirm={submitSearch}
          onBlur={() => setSearchFocused(false)}
        />
        {draftKeyword ? (
          <View
            className='life-search__clear'
            ariaRole='button'
            ariaLabel='清除搜索'
            onClick={() => {
              setCourseSearch(null)
              setDraftKeyword('')
              setKeyword('')
            }}
          >
            清除
          </View>
        ) : null}
        <View
          id={`life-search-submit-${section}`}
          className='life-search__submit'
          hoverClass='life-search__submit--pressed'
          onClick={submitSearch}
        >
          搜索
        </View>
      </View>

      {section === 'errands' && (
        <View className='errand-scope'>
          <View className='errand-scope__signal'><View /></View>
          <View>
            <Text>当前展示全校待接任务</Text>
            <Text>公开任务按发布时间排列</Text>
          </View>
          <Text>{loading ? '—' : `${total} 条`}</Text>
        </View>
      )}
      {section === 'market' && (
        <MarketplaceFilters value={marketFilters} onChange={setMarketFilters} />
      )}
      {section === 'carpool' && (
        <CarpoolFilters value={carpoolFilters} onChange={setCarpoolFilters} />
      )}

      <View className='life-panel__heading'>
        <View>
          <Text>{resultTitle}</Text>
          <Text>{loading ? '正在连接校园服务' : `${total} 条结果`}</Text>
        </View>
        {(keyword || hasStructuredFilters) && (
          <View onClick={clearAll}>清除条件</View>
        )}
      </View>

      {loading && (
        <View className={`business-skeleton business-skeleton--${section}`}>
          <View><View /><View /><View /></View>
          <View><View /><View /><View /></View>
        </View>
      )}

      {!loading && error && (
        <View className='life-state life-state--error'>
          <View className='life-state__symbol'>!</View>
          <Text>{error}</Text>
          <View onClick={() => void load(1, false)}>重新加载</View>
        </View>
      )}

      {!loading && !error && section === 'errands' && (
        <View className='errand-list'>
          {(items as ErrandView[]).map((item) => (
            <ErrandCard key={item.id} item={item} />
          ))}
        </View>
      )}

      {!loading && !error && section === 'market' && (
        <View className='marketplace-grid'>
          {(items as MarketplaceListingView[]).map((item) => (
            <MarketplaceCard key={item.id} item={item} />
          ))}
        </View>
      )}

      {!loading && !error && section === 'carpool' && (
        <View className='carpool-groups'>
          {carpoolGroups.map((group) => (
            <View key={group.key} className='carpool-group'>
              <View className='carpool-group__heading'>
                <Text>{group.label}</Text>
                <Text>{group.trips.length} 个计划</Text>
              </View>
              <View className='carpool-list'>
                {group.trips.map((item) => (
                  <CarpoolCard key={item.id} item={item} />
                ))}
              </View>
            </View>
          ))}
        </View>
      )}

      {!loading && !error && items.length === 0 && (
        <View className={`life-state life-state--empty life-state--${section}`}>
          <View className='life-state__empty-mark'>
            <View />
            <View />
          </View>
          <Text>
            {courseSearch
              ? `暂未找到《${courseSearch.courseName}》相关资料`
              : keyword ? '没有找到匹配结果' : emptyCopy[section].title}
          </Text>
          <Text>
            {courseSearch
              ? '可以发布求购，让有资料的同学联系你'
              : keyword ? '换个关键词或调整筛选条件' : emptyCopy[section].subtitle}
          </Text>
          {courseSearch ? (
            <View className='course-market-empty__actions'>
              <View
                className='course-market-empty__primary'
                hoverClass='course-market-empty__button--pressed'
                onClick={() => void openCourseMarketplacePublisher({
                  ...courseSearch,
                  intent: 'wanted',
                })}
              >
                发布求购
              </View>
              <View
                className='course-market-empty__secondary'
                hoverClass='course-market-empty__button--pressed'
                onClick={clearAll}
              >
                查看全部资料
              </View>
            </View>
          ) : (keyword || hasStructuredFilters) && (
            <View onClick={clearAll}>清除筛选</View>
          )}
        </View>
      )}

      {!loading && !error && canLoadMore && (
        <View
          className='life-load-more'
          id={`life-load-more-${section}`}
          onClick={() => !loadingMore && void load(page + 1, true)}
        >
          {loadingMore ? '正在加载' : '查看更多'}
        </View>
      )}
    </View>
  )
}
