import { useCallback, useRef, useState } from 'react'
import Taro, { useDidHide, useDidShow, usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { Image, ScrollView, Text, View } from '@tarojs/components'
import {
  listAffiliateCategories,
  listAffiliateProducts,
  listAffiliateTopics,
  type AffiliateProduct,
  type AffiliateTaxonomy,
} from '../../api/affiliate'
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
import {
  loadAffiliateShortcutDocument,
  nextAffiliateShortcutBoundary,
  visibleAffiliateShortcuts,
  type AffiliateShortcutDocument,
  type AffiliateShortcutItem,
} from '../../features/affiliate-shortcuts/config'
import './index.scss'

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
  const requestRevision = useRef(0)
  const shortcutRequestRevision = useRef(0)
  const shortcutDocumentRef = useRef<AffiliateShortcutDocument | null>(null)
  const shortcutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handledCapabilityRevision = useRef(0)
  const taxonomyRequested = useRef(false)
  const loadingRef = useRef(false)
  const loadedRef = useRef(false)

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
      void loadTaxonomies()
      if (!loadedRef.current) void loadProducts(1)
    })
  })

  useDidHide(() => {
    shortcutRequestRevision.current += 1
    shortcutDocumentRef.current = null
    if (shortcutTimerRef.current) clearTimeout(shortcutTimerRef.current)
    shortcutTimerRef.current = null
  })

  usePullDownRefresh(() => {
    void loadShortcuts()
    void refreshAffiliateCapabilities().then((snapshot) => {
      if (!snapshot.capabilities.enabled) return
      return Promise.all([loadTaxonomies(true), loadProducts(1)])
    }).finally(() => {
      Taro.stopPullDownRefresh()
    })
  })

  useReachBottom(() => {
    if (!capabilities.enabled || loadingRef.current || error || loadMoreError || products.length >= total || !loaded) return
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
          <Text>搜商品、优惠券</Text>
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

      {categories.length > 0 && (
        <ScrollView className='affiliate-home__taxonomy-scroll' scrollX enhanced showScrollbar={false}>
          <View className='affiliate-home__taxonomy-list'>
            <View
              className={`affiliate-home__chip ${!categoryId && !topicId ? 'affiliate-home__chip--active' : ''}`}
              ariaRole='button'
              onClick={() => chooseCategory(undefined)}
            >全部</View>
            {categories.map((category) => (
              <View
                key={category.id}
                className={`affiliate-home__chip ${categoryId === category.id ? 'affiliate-home__chip--active' : ''}`}
                ariaRole='button'
                onClick={() => chooseCategory(category.id)}
              >
                {category.name}
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {topics.length > 0 && (
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

      <View className='affiliate-home__feed'>
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
      </View>

      {purchaseProduct && (
        <CouponPurchaseSheet product={purchaseProduct} onClose={() => setPurchaseProduct(null)} />
      )}
    </View>
  )
}
