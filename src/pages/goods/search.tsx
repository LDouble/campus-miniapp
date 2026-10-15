import { useCallback, useEffect, useRef, useState } from 'react'
import Taro, {
  useDidHide,
  useDidShow,
  useLoad,
  useReachBottom,
} from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import {
  resolveAffiliateContent,
  searchAffiliateGoods,
  type AffiliateGoodsSearchFilters,
  type AffiliateGoodsSearchSort,
  type AffiliateGoods,
} from '../../api/affiliate'
import CustomNavbar from '../../components/custom-navbar'
import type { AffiliatePurchaseProduct } from '../../features/affiliate/components/product-card'
import AffiliateProductCard from '../../features/affiliate/components/product-card'
import CouponPurchaseSheet from '../../features/affiliate/components/coupon-purchase-sheet'
import { cacheAffiliateGoods } from '../../features/affiliate/session-cache'
import { validateAffiliateSearchFilter } from '../../features/affiliate/search-filters'
import {
  AFFILIATE_GOODS_SEARCH_CATEGORIES,
  type AffiliateGoodsSearchCategoryId,
} from '../../features/affiliate/search-categories'
import { shouldContinueAffiliateSearch } from '../../features/affiliate/search-pagination'
import {
  getAffiliateCapabilitySnapshot,
  refreshAffiliateCapabilities,
} from '../../features/affiliate/capabilities'
import { canUseAffiliateCapability } from '../../features/affiliate/capability-policy'
import { useAffiliateCapabilities } from '../../features/affiliate/use-capabilities'
import { KeyboardSafeInput } from '../../components/keyboard-safe-input'
import { setCustomTabBarHidden } from '../../utils/tabbar'
import './search.scss'

const resolveStatusText = {
  unsupported_format: '暂不支持这种内容，请粘贴淘宝或天猫商品链接、淘口令。',
  not_found: '没有找到对应商品，请检查链接或口令后重试。',
  unavailable: '商品信息暂时无法核验，请稍后再试。',
  resolved: '商品信息已核验。',
} as const

const mergeGoods = (current: AffiliateGoods[], incoming: AffiliateGoods[]) => {
  const items = new Map(current.map((item) => [item.goods_id, item]))
  incoming.forEach((item) => items.set(item.goods_id, item))
  return Array.from(items.values())
}

type AffiliateSearchQuery = {
  keyword: string
  filters: AffiliateGoodsSearchFilters
}

type AffiliateSearchResult = {
  query: AffiliateSearchQuery | null
  items: AffiliateGoods[]
  page: number
  total: number
  hasMore: boolean
}

const sortOptions: Array<{ label: string; value: AffiliateGoodsSearchSort }> = [
  { label: '综合', value: 'comprehensive' },
  { label: '销量', value: 'sales' },
  { label: '低价', value: 'price_asc' },
  { label: '高价', value: 'price_desc' },
]

export default function AffiliateSearchPage() {
  const capabilitySnapshot = useAffiliateCapabilities()
  const capabilities = capabilitySnapshot.capabilities
  const [keyword, setKeyword] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState<AffiliateSearchQuery | null>(null)
  const [searchResult, setSearchResult] = useState<AffiliateSearchResult>({
    query: null,
    items: [],
    page: 0,
    total: 0,
    hasMore: false,
  })
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [loadMoreError, setLoadMoreError] = useState(false)
  const [resolveLoading, setResolveLoading] = useState(false)
  const [resolveMessage, setResolveMessage] = useState('')
  const [resolvedGoods, setResolvedGoods] = useState<AffiliateGoods | null>(null)
  const [purchaseProduct, setPurchaseProduct] = useState<AffiliatePurchaseProduct | null>(null)
  const [searchFilters, setSearchFilters] = useState<AffiliateGoodsSearchFilters>({ sort: 'comprehensive' })
  const [filterExpanded, setFilterExpanded] = useState(false)
  const [draftHasCoupon, setDraftHasCoupon] = useState(false)
  const [draftCategoryId, setDraftCategoryId] = useState<AffiliateGoodsSearchCategoryId | undefined>()
  const [draftMinPrice, setDraftMinPrice] = useState('')
  const [draftMaxPrice, setDraftMaxPrice] = useState('')
  const [filterMessage, setFilterMessage] = useState('')
  const previousCapabilities = useRef(capabilities)
  const searchRevision = useRef(0)
  const submittedQueryRef = useRef<AffiliateSearchQuery | null>(null)
  const handledCapabilityRevision = useRef(0)
  const resolveRevision = useRef(0)
  const loadingRef = useRef(false)
  const resolveInFlightRef = useRef(false)
  const initialSearchPending = useRef(false)

  const hasCurrentResults = submittedQuery !== null && searchResult.query === submittedQuery
  const searched = submittedQuery !== null
  const items = hasCurrentResults ? searchResult.items : []
  const page = hasCurrentResults ? searchResult.page : 0
  const total = hasCurrentResults ? searchResult.total : 0
  const hasMore = hasCurrentResults && searchResult.hasMore

  const runSearch = useCallback(async (
    query: AffiliateSearchQuery,
    nextPage = 1,
  ) => {
    const normalizedKeyword = query.keyword.trim()
    if (!normalizedKeyword) {
      Taro.showToast({ title: '先输入商品关键词', icon: 'none' })
      return
    }
    if (loadingRef.current) return
    loadingRef.current = true
    const revision = searchRevision.current + 1
    searchRevision.current = revision
    setLoadError('')
    setLoadMoreError(false)
    if (nextPage === 1) setLoading(true)
    else setLoadingMore(true)
    try {
      const latestCapabilities = await refreshAffiliateCapabilities()
      if (searchRevision.current !== revision) return
      if (!canUseAffiliateCapability(latestCapabilities.capabilities, 'search')) {
        setLoadError('商品搜索功能暂不可用，请稍后再试。')
        return
      }
      const result = await searchAffiliateGoods(normalizedKeyword, nextPage, query.filters)
      if (searchRevision.current !== revision
        || submittedQueryRef.current !== query
        || !getAffiliateCapabilitySnapshot().capabilities.search_enabled) return
      setSearchResult((current) => {
        if (searchRevision.current !== revision || submittedQueryRef.current !== query) return current
        if (nextPage !== 1 && current.query !== query) return current
        return {
          query,
          items: nextPage === 1 ? mergeGoods([], result.items) : mergeGoods(current.items, result.items),
          page: result.page,
          total: result.total,
          hasMore: shouldContinueAffiliateSearch(
            result.page,
            result.page_size,
            result.total,
          ),
        }
      })
    } catch (error) {
      if (searchRevision.current !== revision) return
      if (nextPage === 1) setLoadError(error instanceof Error ? error.message : '搜索失败，请稍后重试')
      else setLoadMoreError(true)
    } finally {
      if (searchRevision.current === revision) {
        loadingRef.current = false
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }, [])

  const runSearchRef = useRef(runSearch)
  runSearchRef.current = runSearch

  useEffect(() => {
    if (!capabilitySnapshot.loaded || handledCapabilityRevision.current === capabilitySnapshot.revision) return
    handledCapabilityRevision.current = capabilitySnapshot.revision
    const previous = previousCapabilities.current
    const searchChanged = previous.enabled !== capabilities.enabled
      || previous.search_enabled !== capabilities.search_enabled
    const resolveChanged = previous.enabled !== capabilities.enabled
      || previous.resolve_enabled !== capabilities.resolve_enabled
    const convertChanged = previous.enabled !== capabilities.enabled
      || previous.convert_enabled !== capabilities.convert_enabled
    previousCapabilities.current = capabilities

    if (searchChanged) {
      searchRevision.current += 1
      loadingRef.current = false
      setLoading(false)
      setLoadingMore(false)
      submittedQueryRef.current = null
      setSubmittedQuery(null)
      setSearchResult({ query: null, items: [], page: 0, total: 0, hasMore: false })
      setLoadError('')
      setLoadMoreError(false)
    }
    if (resolveChanged) {
      resolveRevision.current += 1
      resolveInFlightRef.current = false
      setResolveLoading(false)
      setResolvedGoods(null)
      setResolveMessage('')
    }
    if (convertChanged) setPurchaseProduct(null)
    if (initialSearchPending.current
      && canUseAffiliateCapability(capabilities, 'search')
      && keyword.trim()) {
      initialSearchPending.current = false
      const query = { keyword: keyword.trim(), filters: { ...searchFilters } }
      submittedQueryRef.current = query
      setSubmittedQuery(query)
      void runSearchRef.current(query, 1)
    }
  }, [capabilitySnapshot.loaded, capabilitySnapshot.revision, capabilities, keyword, searchFilters])

  useLoad((options) => {
    const initialKeyword = typeof options.keyword === 'string' ? options.keyword.trim() : ''
    if (initialKeyword) {
      setKeyword(initialKeyword)
      initialSearchPending.current = true
    }
    if (options.mode === 'resolve') {
      setResolveMessage('粘贴淘宝或天猫商品链接、淘口令后，系统会为你查询商品优惠。')
    }
  })

  useDidShow(() => {
    setCustomTabBarHidden(true)
    void refreshAffiliateCapabilities()
  })
  useDidHide(() => {
    setCustomTabBarHidden(false)
    const wasResolving = resolveInFlightRef.current
    resolveRevision.current += 1
    resolveInFlightRef.current = false
    setResolveLoading(false)
    if (wasResolving) setResolveMessage('当前页面已离开，查询已取消。')
  })

  useEffect(() => () => {
    resolveRevision.current += 1
    resolveInFlightRef.current = false
  }, [])

  const loadNextPage = (retryAfterError = false) => {
    const query = submittedQueryRef.current
    if (!canUseAffiliateCapability(capabilities, 'search')
      || loadingRef.current
      || (!retryAfterError && loadMoreError)
      || !query
      || query !== submittedQuery
      || !hasCurrentResults
      || !hasMore
      || !searched
      || page <= 0) return
    void runSearch(query, page + 1)
  }

  useReachBottom(() => loadNextPage())

  const handleSearch = () => {
    if (!canUseAffiliateCapability(capabilities, 'search')) {
      Taro.showToast({ title: '商品搜索功能暂不可用', icon: 'none' })
      return
    }
    const normalizedKeyword = keyword.trim()
    if (!normalizedKeyword) {
      Taro.showToast({ title: '先输入商品关键词', icon: 'none' })
      return
    }
    initialSearchPending.current = false
    searchRevision.current += 1
    loadingRef.current = false
    resolveRevision.current += 1
    resolveInFlightRef.current = false
    setResolveLoading(false)
    setLoadingMore(false)
    setResolvedGoods(null)
    setResolveMessage('')
    setFilterMessage('')
    const query = { keyword: normalizedKeyword, filters: { ...searchFilters } }
    submittedQueryRef.current = query
    setSubmittedQuery(query)
    setLoadError('')
    setLoadMoreError(false)
    void runSearch(query)
  }

  const retrySearch = () => {
    const query = submittedQueryRef.current
    if (!query || query !== submittedQuery || !canUseAffiliateCapability(capabilities, 'search')) return
    void runSearch(query, 1)
  }

  const openFilterPanel = () => {
    if (!filterExpanded) {
      setDraftHasCoupon(searchFilters.has_coupon === true)
      setDraftCategoryId(searchFilters.category_id)
      setDraftMinPrice(searchFilters.min_price || '')
      setDraftMaxPrice(searchFilters.max_price || '')
      setFilterMessage('')
    }
    setFilterExpanded((current) => !current)
  }

  const applySort = (sort: AffiliateGoodsSearchSort) => {
    if (loadingRef.current || searchFilters.sort === sort) return
    const nextFilters = { ...searchFilters, sort }
    setSearchFilters(nextFilters)
    const currentQuery = submittedQueryRef.current
    if (currentQuery) {
      const query = { keyword: currentQuery.keyword, filters: nextFilters }
      submittedQueryRef.current = query
      setSubmittedQuery(query)
      setLoadError('')
      setLoadMoreError(false)
      void runSearch(query)
    }
  }

  const applyFilters = () => {
    if (loadingRef.current) {
      Taro.showToast({ title: '正在搜索，请稍后再筛选', icon: 'none' })
      return
    }
    const validation = validateAffiliateSearchFilter({
      hasCouponOnly: draftHasCoupon,
      categoryId: draftCategoryId,
      minPrice: draftMinPrice,
      maxPrice: draftMaxPrice,
    })
    if (!validation.valid) {
      setFilterMessage(validation.message)
      return
    }
    const nextFilters: AffiliateGoodsSearchFilters = {
      ...validation.filters,
      sort: searchFilters.sort || 'comprehensive',
    }
    setSearchFilters(nextFilters)
    setFilterMessage('')
    setFilterExpanded(false)
    const currentQuery = submittedQueryRef.current
    if (currentQuery) {
      const query = { keyword: currentQuery.keyword, filters: nextFilters }
      submittedQueryRef.current = query
      setSubmittedQuery(query)
      setLoadError('')
      setLoadMoreError(false)
      void runSearch(query)
    }
  }

  const resetFilters = () => {
    setDraftHasCoupon(false)
    setDraftCategoryId(undefined)
    setDraftMinPrice('')
    setDraftMaxPrice('')
    setFilterMessage('')
  }

  const handlePasteAndResolve = async () => {
    const capabilitySnapshotAtStart = getAffiliateCapabilitySnapshot()
    if (!canUseAffiliateCapability(capabilities, 'resolve')
      || !canUseAffiliateCapability(capabilitySnapshotAtStart.capabilities, 'resolve')) {
      setResolveMessage('链接解析功能暂不可用，请稍后再试。')
      return
    }
    if (resolveInFlightRef.current || resolveLoading) return
    const revision = resolveRevision.current + 1
    resolveRevision.current = revision
    const capabilityRevision = capabilitySnapshotAtStart.revision
    const isCurrentOperation = () => {
      const currentCapabilities = getAffiliateCapabilitySnapshot()
      return resolveRevision.current === revision
        && currentCapabilities.revision === capabilityRevision
        && canUseAffiliateCapability(currentCapabilities.capabilities, 'resolve')
    }

    resolveInFlightRef.current = true
    setResolveLoading(true)
    setResolveMessage('正在核验商品和优惠信息…')
    setResolvedGoods(null)

    let content = ''
    try {
      let clipboard: Awaited<ReturnType<typeof Taro.getClipboardData>>
      try {
        clipboard = await Taro.getClipboardData()
      } catch {
        if (isCurrentOperation()) {
          setResolveMessage('读取剪贴板失败，请确认已复制商品链接或淘口令。')
        }
        return
      }
      if (!isCurrentOperation()) return
      content = String(clipboard.data || '').trim()
      if (!content) {
        setResolveMessage('剪贴板里没有内容，请先复制淘宝或天猫商品链接、淘口令。')
        return
      }
      if (content.length > 2048) {
        setResolveMessage('剪贴板内容过长，请只复制商品链接或淘口令后重试。')
        return
      }

      const latestCapabilities = await refreshAffiliateCapabilities()
      if (!isCurrentOperation()) return
      if (!canUseAffiliateCapability(latestCapabilities.capabilities, 'resolve')) {
        setResolveMessage('链接解析功能暂不可用，请稍后再试。')
        return
      }

      const result = await resolveAffiliateContent(content)
      if (!isCurrentOperation()) return
      if (result.status === 'resolved' && result.product) {
        cacheAffiliateGoods(result.product)
        setResolvedGoods(result.product)
        setResolveMessage(resolveStatusText.resolved)
      } else {
        setResolveMessage(resolveStatusText[result.status])
      }
    } catch (error) {
      if (!isCurrentOperation()) return
      setResolveMessage(error instanceof Error ? error.message : '解析失败，请稍后重试。')
    } finally {
      if (resolveRevision.current === revision) {
        resolveInFlightRef.current = false
        setResolveLoading(false)
        if (!isCurrentOperation()) setResolveMessage('查询已中断，请重试。')
      }
    }
  }

  const openGoodsDetail = (goods: AffiliateGoods) => {
    cacheAffiliateGoods(goods)
    Taro.navigateTo({ url: `/pages/goods/detail?goods_id=${encodeURIComponent(goods.goods_id)}` })
  }

  if (!capabilitySnapshot.loaded) {
    return (
      <View className='affiliate-search'>
        <CustomNavbar title='搜索优惠券' showBack />
        <View className='affiliate-search__state' ariaRole='status'>正在检查好物服务…</View>
      </View>
    )
  }

  if (!capabilities.enabled) {
    return (
      <View className='affiliate-search'>
        <CustomNavbar title='搜索优惠券' showBack />
        <View className='affiliate-search__state'>
          <Text>好物服务暂时关闭</Text>
          <Text>当前无法查询商品优惠或生成推广链接，请稍后再试。</Text>
        </View>
      </View>
    )
  }

  const searchEnabled = canUseAffiliateCapability(capabilities, 'search')
  const resolveEnabled = canUseAffiliateCapability(capabilities, 'resolve')
  const convertEnabled = canUseAffiliateCapability(capabilities, 'convert')

  return (
    <View className='affiliate-search'>
      <CustomNavbar title='搜索优惠券' showBack />

      {searchEnabled ? <View className='affiliate-search__form'>
        <View className='affiliate-search__input-wrap'>
          <Image className='affiliate-search__search-icon' src={require('../../assets/community/topbar-search.svg')} mode='aspectFit' />
          <KeyboardSafeInput
            className='affiliate-search__input'
            value={keyword}
            maxlength={100}
            confirmType='search'
            placeholder='输入商品名称，比如「宿舍收纳」'
            onInput={(event) => setKeyword(event.detail.value)}
            onConfirm={handleSearch}
          />
          {keyword && (
            <View
              className='affiliate-search__clear'
              ariaRole='button'
              ariaLabel='清空搜索词'
              onClick={() => setKeyword('')}
            >×</View>
          )}
        </View>
        <View className='affiliate-search__submit' ariaRole='button' onClick={handleSearch}>搜索</View>
      </View> : (
        <View className='affiliate-search__state'>商品搜索功能暂不可用。</View>
      )}

      {resolveEnabled ? <View className='affiliate-search__resolve-panel'>
        <View className='affiliate-search__resolve-copy'>
          <Text className='affiliate-search__resolve-title'>复制商品链接，快速查券</Text>
          <Text className='affiliate-search__resolve-note'>支持淘宝、天猫链接或淘口令</Text>
        </View>
        <View
          className={`affiliate-search__paste-button ${resolveLoading ? 'affiliate-search__paste-button--busy' : ''}`}
          ariaRole='button'
          ariaLabel='粘贴剪贴板内容并查询优惠券'
          onClick={() => void handlePasteAndResolve()}
        >
          <Text>{resolveLoading ? '核验中…' : '粘贴查券'}</Text>
        </View>
        {resolveMessage && <Text className='affiliate-search__resolve-message'>{resolveMessage}</Text>}
        {resolvedGoods && (
          <AffiliateProductCard
            product={resolvedGoods}
            onOpen={() => openGoodsDetail(resolvedGoods)}
            onBuy={setPurchaseProduct}
            canConvert={convertEnabled}
          />
        )}
      </View> : (
        <View className='affiliate-search__state'>链接解析功能暂不可用。</View>
      )}

      {searchEnabled && <>
      <View className='affiliate-search__results-heading'>
        <Text>搜索结果</Text>
        {hasCurrentResults && <Text>{total} 件商品</Text>}
      </View>
      {searched && (
        <View className='affiliate-search__controls'>
          <View className='affiliate-search__sort-row' ariaLabel='商品排序'>
            {sortOptions.map((option) => (
              <View
                key={option.value}
                className={`affiliate-search__sort-option ${searchFilters.sort === option.value ? 'affiliate-search__sort-option--active' : ''} ${loading ? 'affiliate-search__sort-option--disabled' : ''}`}
                ariaRole='button'
                ariaLabel={`按${option.label}排序`}
                onClick={() => applySort(option.value)}
              >
                <Text>{option.label}</Text>
                {option.value === 'price_asc' && <Text className='affiliate-search__sort-hint'>↑</Text>}
                {option.value === 'price_desc' && <Text className='affiliate-search__sort-hint'>↓</Text>}
              </View>
            ))}
          </View>
          <View
            className={`affiliate-search__filter-toggle ${filterExpanded || searchFilters.category_id || searchFilters.has_coupon || searchFilters.min_price || searchFilters.max_price ? 'affiliate-search__filter-toggle--active' : ''}`}
            ariaRole='button'
            ariaLabel='打开筛选条件'
            onClick={openFilterPanel}
          >
            <Text>筛选</Text>
            <Text className='affiliate-search__filter-chevron'>{filterExpanded ? '⌃' : '⌄'}</Text>
          </View>
          {filterExpanded && (
            <View className='affiliate-search__filter-panel'>
              <View className='affiliate-search__filter-label'>商品分类</View>
              <View className='affiliate-search__category-grid' ariaLabel='选择商品一级分类'>
                <View
                  className={`affiliate-search__category-option ${draftCategoryId === undefined ? 'affiliate-search__category-option--selected' : ''}`}
                  ariaRole='radio'
                  ariaLabel={`全部分类，${draftCategoryId === undefined ? '已选中' : '未选中'}`}
                  onClick={() => setDraftCategoryId(undefined)}
                >
                  <Text>全部</Text>
                </View>
                {AFFILIATE_GOODS_SEARCH_CATEGORIES.map((category) => (
                  <View
                    key={category.id}
                    className={`affiliate-search__category-option ${draftCategoryId === category.id ? 'affiliate-search__category-option--selected' : ''}`}
                    ariaRole='radio'
                    ariaLabel={`${category.label}，${draftCategoryId === category.id ? '已选中' : '未选中'}`}
                    onClick={() => setDraftCategoryId(category.id)}
                  >
                    <Text>{category.label}</Text>
                  </View>
                ))}
              </View>
              <View className='affiliate-search__filter-label affiliate-search__filter-label--coupon'>优惠条件</View>
              <View
                className={`affiliate-search__coupon-option ${draftHasCoupon ? 'affiliate-search__coupon-option--selected' : ''}`}
                ariaRole='checkbox'
                ariaLabel={`仅有券，${draftHasCoupon ? '已选中' : '未选中'}`}
                onClick={() => setDraftHasCoupon((current) => !current)}
              >
                <View className='affiliate-search__checkbox'>{draftHasCoupon ? '✓' : ''}</View>
                <Text>仅有券</Text>
              </View>
              <View className='affiliate-search__price-label'>券后价区间</View>
              <View className='affiliate-search__price-range'>
                <KeyboardSafeInput
                  className='affiliate-search__price-input'
                  type='digit'
                  maxlength={16}
                  value={draftMinPrice}
                  placeholder='最低价'
                  onInput={(event) => setDraftMinPrice(event.detail.value)}
                />
                <Text className='affiliate-search__price-separator'>—</Text>
                <KeyboardSafeInput
                  className='affiliate-search__price-input'
                  type='digit'
                  maxlength={16}
                  value={draftMaxPrice}
                  placeholder='最高价'
                  onInput={(event) => setDraftMaxPrice(event.detail.value)}
                />
                <Text className='affiliate-search__price-unit'>元</Text>
              </View>
              {filterMessage && <Text className='affiliate-search__filter-error'>{filterMessage}</Text>}
              <View className='affiliate-search__filter-actions'>
                <View className='affiliate-search__filter-reset' ariaRole='button' onClick={resetFilters}>重置</View>
                <View className='affiliate-search__filter-apply' ariaRole='button' onClick={applyFilters}>完成</View>
              </View>
            </View>
          )}
        </View>
      )}
      {loading && !items.length && <View className='affiliate-search__state' ariaRole='status'>正在搜索商品…</View>}
      {!loading && loadError && (
        <View className='affiliate-search__state affiliate-search__state--error'>
          <Text>{loadError}</Text>
          <View className='affiliate-search__retry' ariaRole='button' onClick={retrySearch}>重新搜索</View>
        </View>
      )}
      {!loading && searched && !loadError && items.length === 0 && !hasMore && (
        <View className='affiliate-search__state'>没有找到相关商品，换个关键词试试。</View>
      )}
      {!searched && !resolveMessage && (
        <View className='affiliate-search__state'>输入关键词搜索，或粘贴商品链接查询优惠。</View>
      )}
      <View className='affiliate-search__results'>
        {items.map((item) => (
          <AffiliateProductCard
            key={item.goods_id}
            product={item}
            onOpen={() => openGoodsDetail(item)}
            onBuy={setPurchaseProduct}
            canConvert={convertEnabled}
          />
        ))}
      </View>
      {loadingMore && <View className='affiliate-search__load-more' ariaRole='status'>正在加载更多…</View>}
      {!loadingMore && loadMoreError && searchEnabled && (
        <View className='affiliate-search__load-more affiliate-search__load-more--retry' ariaRole='button' onClick={() => loadNextPage(true)}>
          加载失败，点此重试
        </View>
      )}
      {!loadingMore && hasMore && !loadMoreError && searchEnabled && (
        <View className='affiliate-search__load-more' ariaRole='button' onClick={() => loadNextPage()}>继续上滑或点击查看更多</View>
      )}
      {items.length > 0 && !hasMore && !loadMoreError && (
        <View className='affiliate-search__load-more'>已经到底了</View>
      )}
      </>}

      {purchaseProduct && (
        <CouponPurchaseSheet product={purchaseProduct} onClose={() => setPurchaseProduct(null)} />
      )}
    </View>
  )
}
