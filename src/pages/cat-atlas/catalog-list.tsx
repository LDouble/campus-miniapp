import { Image, Text, View } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CustomNavbar from '../../components/custom-navbar'
import { listCats, type CatSort, type CatView } from '../../api/cat-atlas'
import { RequestState } from '../../features/cat-atlas/ui'
import { catPhotoHeightPercent } from '../../features/cat-atlas/photo-layout'
import { mergeVisibleCats } from '../../features/cat-atlas/return-refresh'
import { KeyboardSafeInput } from '../../components/keyboard-safe-input'
import { useCollapsingHeader } from '../../hooks/use-collapsing-header'
import { navigateToWithGuard } from '../../utils/navigation'
import './catalog.scss'

const searchIcon = require('../../assets/cat-atlas/figma/search.svg')
const catJournalArt = require('../../assets/cat-atlas/figma/journal-cat.svg')
const locationIcon = require('../../assets/cat-atlas/figma/location.svg')
const chevronRightIcon = require('../../assets/cat-atlas/figma/chevron-right.svg')
const chevronDownIcon = require('../../assets/cat-atlas/figma/chevron-down.svg')
const plusIcon = require('../../assets/cat-atlas/figma/plus.svg')

const areas = ['全部', '崂山校区', '鱼山校区', '西海岸校区']
const sortOptions = ['按遇见次数', '最近遇见', '最新收录']
const PAGE_SIZE = 30

type LoadOptions = { page?: number; append?: boolean }

function FeedPhoto({ source, name, onError }: { source: string; name: string; onError: () => void }) {
  const [heightPercent, setHeightPercent] = useState(75)
  return <View className='cat-journal__photo-frame' style={{ paddingTop: `${heightPercent}%` }}>
    <Image
      className='cat-journal__photo'
      src={source}
      mode='aspectFill'
      lazyLoad
      ariaLabel={`查看${name}的完整照片`}
      onLoad={(event) => setHeightPercent(catPhotoHeightPercent(Number(event.detail.width), Number(event.detail.height)))}
      onError={onError}
      onClick={(event) => {
        event.stopPropagation()
        void Taro.previewImage({ current: source, urls: [source] })
      }}
    />
  </View>
}

const validValues = (values: string[] = []) => values
  .map((value) => value.trim())
  .filter((value) => value && !['待补充', '暂无', '未知'].includes(value))

const formatSeenAt = (value?: string | null) => {
  if (!value) return '尚未记录'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const now = new Date()
  const sameDay = date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday = date.getFullYear() === yesterday.getFullYear()
    && date.getMonth() === yesterday.getMonth()
    && date.getDate() === yesterday.getDate()
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  if (sameDay) return `今天 ${time}`
  if (isYesterday) return `昨天 ${time}`
  return `${date.getMonth() + 1}月${date.getDate()}日 ${time}`
}

function CatJournalCard({ cat }: { cat: CatView }) {
  const rawPhoto = cat.cover_url?.trim() || ''
  const [photoBroken, setPhotoBroken] = useState(false)
  const photo = rawPhoto && !photoBroken ? rawPhoto : ''
  const traits = validValues(cat.traits)
  const location = cat.resident_area || cat.campus || '位置待补充'
  const coat = cat.coat && !['待补充', '暂无', '未知'].includes(cat.coat.trim()) ? cat.coat.trim() : ''
  const tag = traits[0] || coat || '待补充'
  const relationship = cat.sighting_count > 4 ? '熟络' : cat.sighting_count > 0 ? '见过' : '未打卡'
  const goDetail = () => { void navigateToWithGuard(`/pages/cat-atlas/detail?id=${cat.id}`) }
  const goCheckIn = (event: { stopPropagation?: () => void }) => {
    event.stopPropagation?.()
    void navigateToWithGuard(`/pages/cat-atlas/report?id=${cat.id}&name=${encodeURIComponent(cat.name)}`)
  }

  return <View className={`cat-journal__card ${photo ? 'cat-journal__card--photo' : 'cat-journal__card--text'}`} hoverClass='none' onClick={goDetail}>
    <View className='cat-journal__card-head'>
      <View className='cat-journal__card-copy'>
        <View className='cat-journal__title-row'>
          <Text className='cat-journal__card-name'>{cat.name || '待命名猫咪'}</Text>
          <Text className={`cat-journal__name-tag ${photo ? 'cat-journal__name-tag--warm' : 'cat-journal__name-tag--rose'}`}>{photo ? `${coat || '小橘'} · ${cat.sighting_count ? '已见过' : '待起名'}` : tag}</Text>
        </View>
        <View className='cat-journal__meta-row'>
          <View className='cat-journal__location'><Image className='cat-journal__location-icon' src={locationIcon} mode='aspectFit' /><Text>{location}</Text></View>
          {coat && <Text className='cat-journal__dot'>·</Text>}
          {coat && <Text className='cat-journal__coat'>{coat}</Text>}
          {traits[0] && <Text className='cat-journal__trait-tag'>{traits[0]}</Text>}
        </View>
      </View>
      <View className='cat-journal__detail-link' ariaRole='button' onClick={(event) => { event.stopPropagation(); goDetail() }}><Text>认识它</Text><Image src={chevronRightIcon} mode='aspectFit' /></View>
    </View>
    {photo && <View className='cat-journal__hero'>
      <FeedPhoto source={photo} name={cat.name} onError={() => setPhotoBroken(true)} />
      <View className='cat-journal__hero-campus'><Text>{cat.campus || '校园'}</Text></View>
      <View className='cat-journal__hero-time'><Text>最后目击：{formatSeenAt(cat.last_seen_at)}</Text></View>
    </View>}
    <View className='cat-journal__card-footer'>
      <View className='cat-journal__card-stat'>
        {!photo && <View className='cat-journal__stat-dot' />}
        <Text>{photo ? '相遇记录：' : '我的相遇：'}</Text>
        <Text className='cat-journal__stat-number'>{cat.sighting_count} 次</Text>
        {photo ? <Text className='cat-journal__stat-hint'>{cat.sighting_count ? '已打卡' : '(尚未打卡)'}</Text> : <Text className='cat-journal__stat-badge'>{relationship}</Text>}
      </View>
      <View className={`cat-journal__check-in ${photo ? '' : 'cat-journal__check-in--solid'}`} ariaRole='button' onClick={goCheckIn}><Text>{photo ? '＋ 打卡相遇' : `已遇见 +${cat.sighting_count ? 1 : 0}`}</Text></View>
    </View>
  </View>
}

export default function CatAtlasCatalogList() {
  const [items, setItems] = useState<CatView[]>([])
  const [totalCount, setTotalCount] = useState(0)

  const [keyword, setKeyword] = useState('')
  const [query, setQuery] = useState('')
  const [area, setArea] = useState('全部')
  const [sort, setSort] = useState(sortOptions[0])
  const [sortOpen, setSortOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState('')
  const requestVersion = useRef(0)
  const loadingMoreRef = useRef(false)
  const hasMoreRef = useRef(true)
  const hasShownRef = useRef(false)
  const hasLoadedRef = useRef(false)
  const loadedPageRef = useRef(1)
  const headerCollapsed = useCollapsingHeader({ threshold: 100, releaseGap: 28 })

  const load = useCallback(async ({ page: requestedPage = 1, append = false }: LoadOptions = {}) => {
    if (append && (loadingMoreRef.current || !hasMoreRef.current)) return

    const version = requestVersion.current + 1
    requestVersion.current = version
    if (append) {
      loadingMoreRef.current = true
      setLoadingMore(true)
    } else {
      hasLoadedRef.current = false
      loadingMoreRef.current = false
      setLoadingMore(false)
      hasMoreRef.current = true
      setHasMore(true)
      setPage(1)
      setLoading(true)
      setError('')
    }

    try {
      const sortValue: CatSort = sort === '最近遇见' ? 'latest_seen' : sort === '最新收录' ? 'newest' : 'popular'
      let result = await listCats({ keyword: query, area: area === '全部' ? undefined : area, sort: sortValue, page: requestedPage, pageSize: PAGE_SIZE })
      let visibleItems = result.items
      while (visibleItems.length < 6 && result.page * result.page_size < result.total) {
        if (version !== requestVersion.current) return
        result = await listCats({ keyword: query, area: area === '全部' ? undefined : area, sort: sortValue, page: result.page + 1, pageSize: PAGE_SIZE })
        visibleItems = [...visibleItems, ...result.items]
      }
      if (version !== requestVersion.current) return

      setItems((current) => {
        if (!append) return visibleItems
        const merged = new Map(current.map((item) => [item.id, item]))
        visibleItems.forEach((item) => merged.set(item.id, item))
        return Array.from(merged.values())
      })
      setPage(result.page)
      loadedPageRef.current = result.page
      hasLoadedRef.current = true
      setTotalCount(result.total)
      hasMoreRef.current = result.page * result.page_size < result.total
      setHasMore(hasMoreRef.current)


    } catch (loadError) {
      if (version !== requestVersion.current) return
      void Taro.stopPullDownRefresh()
      if (append) {
        void Taro.showToast({ title: loadError instanceof Error ? loadError.message : '加载更多失败，请稍后重试', icon: 'none' })
      } else {
        setError(loadError instanceof Error ? loadError.message : '网络连接不稳定，请稍后重试')
      }
    } finally {
      if (version !== requestVersion.current) return
      if (append) {
        loadingMoreRef.current = false
        setLoadingMore(false)
      } else {
        setLoading(false)
      }
    }
  }, [area, query, sort])

  const refreshVisible = useCallback(async () => {
    if (!hasLoadedRef.current || loadingMoreRef.current) return
    const version = ++requestVersion.current
    const lastPage = loadedPageRef.current
    const sortValue: CatSort = sort === '最近遇见' ? 'latest_seen' : sort === '最新收录' ? 'newest' : 'popular'
    const refreshed: CatView[] = []
    try {
      for (let currentPage = 1; currentPage <= lastPage; currentPage += 1) {
        const result = await listCats({ keyword: query, area: area === '全部' ? undefined : area, sort: sortValue, page: currentPage, pageSize: PAGE_SIZE })
        if (version !== requestVersion.current) return
        refreshed.push(...result.items)
        if (result.page * result.page_size >= result.total) break
      }
      setItems((current) => mergeVisibleCats(current, refreshed))
    } catch {
      // 静默刷新失败不替换列表，也不重置分页或图片的布局状态。
    }
  }, [area, query, sort])

  const loadMore = useCallback(() => {
    if (loading || loadingMoreRef.current || !hasMoreRef.current) return
    void load({ page: page + 1, append: true })
  }, [load, loading, page])

  useEffect(() => {
    void load()
    return () => { requestVersion.current += 1 }
  }, [load])

  useDidShow(() => {
    if (hasShownRef.current) void refreshVisible()
    hasShownRef.current = true
  })
  usePullDownRefresh(() => { void load() })
  useReachBottom(loadMore)

  const submitSearch = () => {
    const nextQuery = keyword.trim()
    if (nextQuery === query) {
      void load()
      return
    }
    setQuery(nextQuery)
  }

  const litCount = useMemo(() => items.filter((cat) => cat.sighting_count > 0).length, [items])
  const sightingTotal = useMemo(() => items.reduce((sum, cat) => sum + Math.max(0, cat.sighting_count || 0), 0), [items])

  const changeSort = (value: string) => { setSort(value); setSortOpen(false) }

  return <View className='cat-journal'>
    <CustomNavbar title='猫猫图鉴' showBack immersive={!headerCollapsed} collapsed={headerCollapsed} />
    <View className='cat-journal__intro'>
      <View className='cat-journal__intro-copy'>
        <Text className='cat-journal__eyebrow'>OUSEA / CAT JOURNAL</Text>
        <Text className='cat-journal__headline'>校园里的小小居民</Text>
        <Text className='cat-journal__subtitle'>每一次遇见，都值得记下来。</Text>
      </View>
      <View className='cat-journal__illustration-wrap'><Image className='cat-journal__illustration' src={catJournalArt} mode='aspectFit' /><Text className='cat-journal__illustration-count'>{totalCount || items.length || 0}只</Text></View>
    </View>
    <View className='cat-journal__stats'><View className='cat-journal__stats-left'><View className='cat-journal__stats-dot' /><Text>近期活跃猫咪 <Text className='cat-journal__stats-strong'>{litCount}</Text> 只</Text></View><Text className='cat-journal__stats-right'>建档 {totalCount || items.length} 只 · 相遇 {sightingTotal} 次</Text></View>
    <View className='cat-journal__search-row'>
    <View className='cat-journal__search'>
      <Image className='cat-journal__search-icon' src={searchIcon} mode='aspectFit' />
      <KeyboardSafeInput className='cat-journal__input' value={keyword} placeholder='找猫咪、地点或毛色' confirmType='search' onInput={(event) => setKeyword(event.detail.value)} onConfirm={submitSearch} />
      <View className='cat-journal__search-submit' ariaRole='button' onClick={submitSearch}><Text>搜索</Text></View>
    </View>
      <View className='cat-journal__discover' ariaRole='button' onClick={() => void navigateToWithGuard('/pages/cat-atlas/report?mode=new')}><Image src={plusIcon} mode='aspectFit' /><Text>记录新猫</Text></View>
    </View>
    <View className='cat-journal__campuses'>{areas.map((item) => <View key={item} ariaRole='button' className={`cat-journal__campus ${area === item ? 'is-active' : ''}`} onClick={() => setArea(item)}><Text>{item}</Text></View>)}</View>
    <View className='cat-journal__toolbar'>
      <View className='cat-journal__mine' ariaRole='button' onClick={() => void navigateToWithGuard('/pages/cat-atlas/my-catalog')}><Text>我的相遇图鉴</Text><Text className='cat-journal__mine-badge'>已点亮 {litCount}/{totalCount || items.length}</Text><Text className='cat-journal__mine-arrow'>›</Text></View>
      <View className='cat-journal__sort'>
        <View className='cat-journal__sort-trigger' ariaRole='button' onClick={() => setSortOpen((value) => !value)}><Text>{sort}</Text><Image className='cat-journal__sort-icon' src={chevronDownIcon} mode='aspectFit' /></View>
        {sortOpen && <View className='cat-journal__sort-menu'>{sortOptions.map((item) => <View key={item} className={`cat-journal__sort-option ${sort === item ? 'is-current' : ''}`} onClick={() => changeSort(item)}><Text>{item}</Text><Text>{sort === item ? '✓' : ''}</Text></View>)}</View>}
      </View>
    </View>
    {loading && <RequestState loading />}
    {!loading && error && <RequestState error={error} onRetry={() => void load()} />}
    {!loading && !error && <>
      <RequestState empty={!items.length ? '这里还没有收录猫咪照片' : undefined} />
      <View className='cat-journal__feed'>{items.map((cat) => <CatJournalCard key={cat.id} cat={cat} />)}</View>
      {items.length > 0 && (hasMore ? <View className='cat-journal__load-more' ariaRole='button' onClick={loadMore}><Text>{loadingMore ? '正在寻找更多猫咪…' : '继续看更多猫咪 ↓'}</Text></View> : <View className='cat-journal__end'><Text>已看完 {items.length} 位校园伙伴</Text><Text>下一次相遇，也许就有新朋友。</Text></View>)}
    </>}
  </View>
}
