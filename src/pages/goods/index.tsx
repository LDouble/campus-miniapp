import { useCallback, useRef, useState } from 'react'
import Taro, { useDidHide, useDidShow, usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { Image, ScrollView, Text, View } from '@tarojs/components'
import {
  listAffiliateCategories,
  listAffiliateCatalog,
  listAffiliateProducts,
  listAffiliateTopics,
  type AffiliateCatalogPage,
  type AffiliateProduct,
  type AffiliateTaxonomy,
} from '../../api/affiliate'
import { isApiError } from '../../api/client'
import type { AffiliatePurchaseProduct } from '../../features/affiliate/components/product-card'
import AffiliateProductCard from '../../features/affiliate/components/product-card'
import CouponPurchaseSheet from '../../features/affiliate/components/coupon-purchase-sheet'
import CustomNavbar from '../../components/custom-navbar'
import {
  getAffiliateCapabilitySnapshot,
  refreshAffiliateCapabilities,
} from '../../features/affiliate/capabilities'
import { canUseAffiliateCapability } from '../../features/affiliate/capability-policy'
import { useAffiliateCapabilities } from '../../features/affiliate/use-capabilities'
import { syncCustomTabBar } from '../../utils/tabbar'
import AffiliateShortcutGrid from '../../features/affiliate-shortcuts/shortcut-grid'
import AffiliateRankingSection from '../../features/affiliate/rankings/ranking-section'
import AffiliateCatalogSection from '../../features/affiliate/catalog/catalog-section'
import {
  loadAffiliateShortcutDocument,
  nextAffiliateShortcutBoundary,
  visibleAffiliateShortcuts,
  type AffiliateShortcutDocument,
  type AffiliateShortcutItem,
} from '../../features/affiliate-shortcuts/config'
import { shouldShowAffiliateManualFallback } from '../../features/affiliate/rankings/policy'
import { shouldShowAffiliateCatalogLegacyFallback } from '../../features/affiliate/catalog/policy'
import './index.scss'

const categoryIcons: Record<string, string> = {
  女装: require('../../assets/affiliate/category-women.svg'),
  数码: require('../../assets/affiliate/category-digital.svg'),
  美食: require('../../assets/affiliate/category-food.svg'),
  美妆: require('../../assets/affiliate/category-beauty.svg'),
  居家: require('../../assets/affiliate/category-home.svg'),
  母婴: require('../../assets/affiliate/category-baby.svg'),
}

const PAGE_SIZE = 20

const appendUniqueProducts = (current: AffiliateProduct[], incoming: AffiliateProduct[]) => {
  const items = new Map(current.map((item) => [item.id, item]))
  incoming.forEach((item) => items.set(item.id, item))
  return Array.from(items.values())
}

const openGoodsSearch = (mode?: 'resolve') => {
  Taro.navigateTo({ url: `/pages/goods/search${mode ? `?mode=${mode}` : ''}` })
}

export default function GoodsHomePage() {
  const capabilitySnapshot = useAffiliateCapabilities()
  const capabilities = capabilitySnapshot.capabilities
  const [products, setProducts] = useState<AffiliateProduct[]>([])
  const [categories, setCategories] = useState<AffiliateTaxonomy[]>([])
  const [topics, setTopics] = useState<AffiliateTaxonomy[]>([])
  const [categoryId, setCategoryId] = useState<number | undefined>()
  const [topicId, setTopicId] = useState<number | undefined>()
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [loadMoreError, setLoadMoreError] = useState('')
  const [taxonomyError, setTaxonomyError] = useState('')
  const [shortcuts, setShortcuts] = useState<AffiliateShortcutItem[]>([])
  const [purchaseProduct, setPurchaseProduct] = useState<AffiliatePurchaseProduct | null>(null)
  const [pageActive, setPageActive] = useState(false)
  const [rankingRefreshToken, setRankingRefreshToken] = useState(0)
  const [rankingsEnabled, setRankingsEnabled] = useState<boolean | null>(null)
  const [catalogMode, setCatalogMode] = useState<'checking' | 'enabled' | 'disabled' | 'error'>('checking')
  const [catalogPage, setCatalogPage] = useState<AffiliateCatalogPage | null>(null)
  const [catalogError, setCatalogError] = useState('')
  const [catalogRevision, setCatalogRevision] = useState(0)
  const requestRevision = useRef(0)
  const catalogRequestRevision = useRef(0)
  const shortcutRequestRevision = useRef(0)
  const shortcutDocumentRef = useRef<AffiliateShortcutDocument | null>(null)
  const shortcutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handledCapabilityRevision = useRef(0)
  const taxonomyRequested = useRef(false)
  const loadingRef = useRef(false)
  const loadedRef = useRef(false)
  const pageActiveRef = useRef(false)

  const loadTaxonomies = useCallback(async (force = false) => {
    if (!getAffiliateCapabilitySnapshot().capabilities.enabled) return
    if (taxonomyRequested.current && !force) return
    taxonomyRequested.current = true
    try {
      const [categoryResult, topicResult] = await Promise.all([
        listAffiliateCategories(),
        listAffiliateTopics(),
      ])
      if (!getAffiliateCapabilitySnapshot().capabilities.enabled) return
      setCategories(categoryResult.items)
      setTopics(topicResult.items)
      setTaxonomyError('')
    } catch {
      taxonomyRequested.current = false
      setTaxonomyError('分类和专题暂时不可用')
    }
  }, [])

  const loadProducts = useCallback(async (
    nextPage = 1,
    filters: { category?: number; topic?: number } = { category: categoryId, topic: topicId },
  ) => {
    if (!getAffiliateCapabilitySnapshot().capabilities.enabled) return
    // 主动刷新取代旧翻页，只有追加请求需要等待当前请求完成。
    if (loadingRef.current && nextPage !== 1) return
    loadingRef.current = true
    const revision = requestRevision.current + 1
    requestRevision.current = revision
    setLoadMoreError('')
    if (nextPage === 1) {
      setLoading(true)
      setLoadingMore(false)
      setError('')
    } else {
      setLoadingMore(true)
    }
    try {
      const result = await listAffiliateProducts({
        page: nextPage,
        pageSize: PAGE_SIZE,
        categoryId: filters.category,
        topicId: filters.topic,
      })
      if (requestRevision.current !== revision || !getAffiliateCapabilitySnapshot().capabilities.enabled) return
      setProducts((current) => nextPage === 1
        ? appendUniqueProducts([], result.items)
        : appendUniqueProducts(current, result.items))
      setPage(result.page)
      setTotal(result.total)
      setLoaded(true)
      loadedRef.current = true
    } catch (loadError) {
      if (requestRevision.current !== revision) return
      const message = loadError instanceof Error ? loadError.message : '好物加载失败，请重试'
      if (nextPage === 1) setError(message)
      else setLoadMoreError(message)
    } finally {
      if (requestRevision.current === revision) {
        loadingRef.current = false
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }, [categoryId, topicId])

  const activateLegacyFeed = useCallback(() => {
    setRankingsEnabled(null)
    setRankingRefreshToken((revision) => revision + 1)
    void loadTaxonomies()
    if (!loadedRef.current) void loadProducts(1)
  }, [loadProducts, loadTaxonomies])

  const handleCatalogDisabled = useCallback(() => {
    setCatalogPage(null)
    setCatalogMode('disabled')
    activateLegacyFeed()
  }, [activateLegacyFeed])

  const loadCatalog = useCallback(async () => {
    if (!pageActiveRef.current || !getAffiliateCapabilitySnapshot().capabilities.enabled) return
    const revision = catalogRequestRevision.current + 1
    catalogRequestRevision.current = revision
    requestRevision.current += 1
    loadingRef.current = false
    setLoading(false)
    setLoadingMore(false)
    setCatalogMode('checking')
    setCatalogPage(null)
    setCatalogError('')
    try {
      const result = await listAffiliateCatalog({ page: 1, page_size: PAGE_SIZE })
      if (
        catalogRequestRevision.current !== revision
        || !pageActiveRef.current
        || !getAffiliateCapabilitySnapshot().capabilities.enabled
      ) return
      if (!result.enabled) {
        handleCatalogDisabled()
        return
      }

      setProducts([])
      setCategories([])
      setTopics([])
      taxonomyRequested.current = false
      setLoaded(false)
      loadedRef.current = false
      setCatalogPage(result)
      setCatalogRevision((current) => current + 1)
      setCatalogMode('enabled')
    } catch (loadError) {
      if (
        catalogRequestRevision.current !== revision
        || !pageActiveRef.current
        || !getAffiliateCapabilitySnapshot().capabilities.enabled
      ) return
      setCatalogError(isApiError(loadError) ? loadError.message : '推荐商品暂时不可用，请检查网络后重试。')
      setCatalogMode('error')
    }
  }, [handleCatalogDisabled])

  const showShortcutsForCurrentTime = useCallback((document: AffiliateShortcutDocument | null) => {
    shortcutDocumentRef.current = document
    setShortcuts(visibleAffiliateShortcuts(document))
    if (shortcutTimerRef.current) clearTimeout(shortcutTimerRef.current)
    shortcutTimerRef.current = null

    const scheduleNextBoundary = () => {
      const boundary = nextAffiliateShortcutBoundary(document)
      if (boundary === null) return
      const delay = Math.max(1, Math.min(boundary - Date.now(), 2_147_000_000))
      shortcutTimerRef.current = setTimeout(() => {
        if (shortcutDocumentRef.current !== document) return
        setShortcuts(visibleAffiliateShortcuts(document))
        scheduleNextBoundary()
      }, delay)
    }
    scheduleNextBoundary()
  }, [])

  const loadShortcuts = useCallback(async () => {
    const revision = shortcutRequestRevision.current + 1
    shortcutRequestRevision.current = revision
    if (shortcutTimerRef.current) clearTimeout(shortcutTimerRef.current)
    shortcutTimerRef.current = null
    shortcutDocumentRef.current = null
    setShortcuts([])
    try {
      const document = await loadAffiliateShortcutDocument()
      if (shortcutRequestRevision.current !== revision) return
      showShortcutsForCurrentTime(document)
    } catch {
      // 快捷入口配置读取失败只隐藏入口，不影响推荐商品和筛选加载。
      if (shortcutRequestRevision.current === revision) showShortcutsForCurrentTime(null)
    }
  }, [showShortcutsForCurrentTime])

  useDidShow(() => {
    setPageActive(true)
    pageActiveRef.current = true
    setRankingsEnabled(null)
    setRankingRefreshToken((revision) => revision + 1)
    setCatalogMode('checking')
    setCatalogPage(null)
    syncCustomTabBar('goods')
    void loadShortcuts()
    void refreshAffiliateCapabilities().then((snapshot) => {
      if (handledCapabilityRevision.current !== snapshot.revision) {
        handledCapabilityRevision.current = snapshot.revision
        requestRevision.current += 1
        loadingRef.current = false
        loadedRef.current = false
        taxonomyRequested.current = false
        setProducts([])
        setCategories([])
        setTopics([])
        setLoaded(false)
        setPurchaseProduct(null)
      }
      if (!snapshot.capabilities.enabled) {
        setLoading(false)
        setLoadingMore(false)
        setError('')
        setLoadMoreError('')
        return
      }
      void loadCatalog()
    })
  })

  useDidHide(() => {
    setPageActive(false)
    pageActiveRef.current = false
    catalogRequestRevision.current += 1
    shortcutRequestRevision.current += 1
    shortcutDocumentRef.current = null
    if (shortcutTimerRef.current) clearTimeout(shortcutTimerRef.current)
    shortcutTimerRef.current = null
  })

  usePullDownRefresh(() => {
    void loadShortcuts()
    void refreshAffiliateCapabilities().then((snapshot) => {
      if (!snapshot.capabilities.enabled) return
      return loadCatalog()
    }).finally(() => {
      Taro.stopPullDownRefresh()
    })
  })

  useReachBottom(() => {
    if (catalogMode !== 'disabled' || !shouldShowAffiliateManualFallback(rankingsEnabled) || !capabilities.enabled || loadingRef.current || error || loadMoreError || products.length >= total || !loaded) return
    void loadProducts(page + 1)
  })

  const chooseCategory = (nextCategoryId?: number) => {
    requestRevision.current += 1
    loadingRef.current = false
    setLoadingMore(false)
    setCategoryId(nextCategoryId)
    setTopicId(undefined)
    setProducts([])
    setPage(1)
    void loadProducts(1, { category: nextCategoryId, topic: undefined })
  }

  const chooseTopic = (nextTopicId?: number) => {
    requestRevision.current += 1
    loadingRef.current = false
    setLoadingMore(false)
    setTopicId(nextTopicId)
    setCategoryId(undefined)
    setProducts([])
    setPage(1)
    void loadProducts(1, { category: undefined, topic: nextTopicId })
  }

  const retry = () => {
    if (capabilities.enabled) void loadProducts(1)
  }

  const retryMore = () => {
    if (capabilities.enabled && !loadingRef.current) void loadProducts(page + 1)
  }

  if (!capabilitySnapshot.loaded) {
    return (
      <View className='affiliate-home'>
        <CustomNavbar title='好物' />
        <View className='affiliate-home__state' ariaRole='status'>正在检查好物服务…</View>
      </View>
    )
  }

  if (!capabilities.enabled) {
    return (
      <View className='affiliate-home'>
        <CustomNavbar title='好物' />
        <View className='affiliate-home__state'>
          <Text>好物服务暂时关闭</Text>
          <Text>当前暂不能查询优惠或生成推广链接，请稍后再试。</Text>
        </View>
      </View>
    )
  }

  const searchEnabled = canUseAffiliateCapability(capabilities, 'search')
  const resolveEnabled = canUseAffiliateCapability(capabilities, 'resolve')
  const convertEnabled = canUseAffiliateCapability(capabilities, 'convert')
  const showCatalogFallback = shouldShowAffiliateCatalogLegacyFallback(catalogMode === 'disabled' ? false : null)
  const showManualFallback = showCatalogFallback && shouldShowAffiliateManualFallback(rankingsEnabled)

  return (
    <View className='affiliate-home'>
      <CustomNavbar title='好物' />

      {(searchEnabled || resolveEnabled) && <View className='affiliate-home__search-row'>
        {searchEnabled && <View
          className='affiliate-home__search'
          ariaRole='button'
          ariaLabel='搜索商品和优惠券'
          onClick={() => openGoodsSearch()}
        >
          <Image className='affiliate-home__search-icon' src={require('../../assets/community/topbar-search.svg')} mode='aspectFit' />
          <Text>搜商品、优惠券或粘贴标题</Text>
        </View>}
        {resolveEnabled && <View
          className='affiliate-home__paste'
          ariaRole='button'
          ariaLabel='粘贴淘宝链接查券'
          onClick={() => openGoodsSearch('resolve')}
        >
          <Text>粘贴查券</Text>
        </View>}
      </View>}

      <AffiliateShortcutGrid items={shortcuts} />

      {catalogMode === 'checking' && (
        <View className='affiliate-home__state' ariaRole='status'>正在加载推荐商品…</View>
      )}
      {catalogMode === 'error' && (
        <View className='affiliate-home__state affiliate-home__state--error' ariaRole='alert'>
          <Text>{catalogError || '推荐商品暂时不可用，请稍后重试。'}</Text>
          <View className='affiliate-home__retry' ariaRole='button' onClick={() => void loadCatalog()}>重新加载</View>
        </View>
      )}
      {catalogMode === 'enabled' && catalogPage && (
        <AffiliateCatalogSection
          key={catalogRevision}
          active={pageActive}
          capabilityEnabled={capabilities.enabled}
          canConvert={convertEnabled}
          initialPage={catalogPage}
          onDisabled={handleCatalogDisabled}
          onBuy={setPurchaseProduct}
        />
      )}
      {showCatalogFallback && (
        <AffiliateRankingSection
          active={pageActive}
          capabilityEnabled={capabilities.enabled}
          canConvert={convertEnabled}
          refreshToken={rankingRefreshToken}
          onEnabledChange={setRankingsEnabled}
          onBuy={setPurchaseProduct}
        />
      )}

      {showManualFallback && categories.length > 0 && (
        <ScrollView className='affiliate-home__taxonomy-scroll' scrollX enhanced showScrollbar={false}>
          <View className='affiliate-home__taxonomy-list'>
            <View
              className={`affiliate-home__chip ${!categoryId && !topicId ? 'affiliate-home__chip--active' : ''}`}
              ariaRole='button'
              onClick={() => chooseCategory(undefined)}
            >
              {!categoryId && !topicId && <Image className='affiliate-home__category-icon' src={require('../../assets/affiliate/category-featured.svg')} mode='aspectFit' />}
              <Text>精选</Text>
            </View>
            {categories.map((category) => (
              <View
                key={category.id}
                className={`affiliate-home__chip ${categoryId === category.id ? 'affiliate-home__chip--active' : ''}`}
                ariaRole='button'
                onClick={() => chooseCategory(category.id)}
              >
                {categoryIcons[category.name] && <Image className='affiliate-home__category-icon' src={categoryIcons[category.name]} mode='aspectFit' />}
                <Text>{category.name}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {showManualFallback && topics.length > 0 && (
        <View className='affiliate-home__topics-section'>
          <View className='affiliate-home__section-heading'>
            <Text>精选专题</Text>
            <Text>发现校园生活灵感</Text>
          </View>
          <ScrollView className='affiliate-home__topic-scroll' scrollX enhanced showScrollbar={false}>
            <View className='affiliate-home__topic-list'>
              {topics.map((topic) => (
                <View
                  key={topic.id}
                  className={`affiliate-home__topic ${topicId === topic.id ? 'affiliate-home__topic--active' : ''}`}
                  ariaRole='button'
                  onClick={() => chooseTopic(topicId === topic.id ? undefined : topic.id)}
                >
                  <Text className='affiliate-home__topic-mark'>精选</Text>
                  <Text className='affiliate-home__topic-name'>{topic.name}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {showManualFallback && <View className='affiliate-home__feed'>
        <View className='affiliate-home__section-heading'>
          <View>
            <Text>为你推荐</Text>
            {loaded && <Text>{total} 件好物</Text>}
          </View>
          {taxonomyError && (
            <View
              className='affiliate-home__taxonomy-retry'
              ariaRole='button'
              onClick={() => void loadTaxonomies(true)}
            >重试分类</View>
          )}
        </View>

        {loading && !products.length && (
          <View className='affiliate-home__state' ariaRole='status'>正在为你挑选好物…</View>
        )}
        {!loading && error && (
          <View className='affiliate-home__state affiliate-home__state--error'>
            <Text>{error}</Text>
            <View className='affiliate-home__retry' ariaRole='button' onClick={retry}>重新加载</View>
          </View>
        )}
        {!loading && !error && loaded && products.length === 0 && (
          <View className='affiliate-home__state'>
            <View className='affiliate-home__empty-icon' />
            <Text>这里还没有好物，先去搜搜优惠吧</Text>
            {searchEnabled && (
              <View className='affiliate-home__retry' ariaRole='button' onClick={() => openGoodsSearch()}>
                搜索商品
              </View>
            )}
          </View>
        )}
        <View className='affiliate-home__product-list'>
          {products.map((product) => (
            <AffiliateProductCard
              key={product.id}
              product={product}
              recommendation
              layout='tile'
              clockRefreshKey={pageActive}
              onOpen={() => Taro.navigateTo({ url: `/pages/goods/detail?id=${product.id}` })}
              onBuy={setPurchaseProduct}
              canConvert={convertEnabled}
            />
          ))}
        </View>
        {loadingMore && <View className='affiliate-home__load-more' ariaRole='status'>正在加载更多…</View>}
        {!loadingMore && loadMoreError && (
          <View className='affiliate-home__load-more' ariaRole='alert'>
            <Text>{loadMoreError}</Text>
            <View className='affiliate-home__retry' ariaRole='button' onClick={retryMore}>重试加载更多</View>
          </View>
        )}
        {!loadingMore && !loading && !error && !loadMoreError && products.length > 0 && products.length < total && (
          <View className='affiliate-home__load-more'>继续上滑查看更多</View>
        )}
        {!loadingMore && !loading && !error && !loadMoreError && products.length > 0 && products.length >= total && (
          <View className='affiliate-home__load-more'>已经到底了</View>
        )}
      </View>}

      {purchaseProduct && (
        <CouponPurchaseSheet product={purchaseProduct} onClose={() => setPurchaseProduct(null)} />
      )}
    </View>
  )
}
