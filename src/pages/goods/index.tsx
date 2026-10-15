import { useCallback, useRef, useState } from 'react'
import Taro, { useDidShow, usePullDownRefresh, useReachBottom } from '@tarojs/taro'
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
import { syncCustomTabBar } from '../../utils/tabbar'
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
  const [taxonomyError, setTaxonomyError] = useState('')
  const [purchaseProduct, setPurchaseProduct] = useState<AffiliatePurchaseProduct | null>(null)
  const requestRevision = useRef(0)
  const taxonomyRequested = useRef(false)
  const loadingRef = useRef(false)

  const loadTaxonomies = useCallback(async (force = false) => {
    if (taxonomyRequested.current && !force) return
    taxonomyRequested.current = true
    try {
      const [categoryResult, topicResult] = await Promise.all([
        listAffiliateCategories(),
        listAffiliateTopics(),
      ])
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
    if (loadingRef.current) return
    loadingRef.current = true
    const revision = requestRevision.current + 1
    requestRevision.current = revision
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
      if (requestRevision.current !== revision) return
      setProducts((current) => nextPage === 1
        ? appendUniqueProducts([], result.items)
        : appendUniqueProducts(current, result.items))
      setPage(result.page)
      setTotal(result.total)
      setLoaded(true)
    } catch (loadError) {
      if (requestRevision.current !== revision) return
      if (nextPage === 1) setError(loadError instanceof Error ? loadError.message : '好物加载失败，请重试')
    } finally {
      if (requestRevision.current === revision) {
        loadingRef.current = false
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }, [categoryId, topicId])

  useDidShow(() => {
    syncCustomTabBar('goods')
    void loadTaxonomies()
    if (!loaded) void loadProducts(1)
  })

  usePullDownRefresh(() => {
    void Promise.all([loadTaxonomies(true), loadProducts(1)]).finally(() => {
      Taro.stopPullDownRefresh()
    })
  })

  useReachBottom(() => {
    if (loadingRef.current || products.length >= total || !loaded) return
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

  const retry = () => void loadProducts(1)

  return (
    <View className='affiliate-home'>
      <CustomNavbar title='好物' />

      <View className='affiliate-home__search-row'>
        <View
          className='affiliate-home__search'
          ariaRole='button'
          ariaLabel='搜索商品和优惠券'
          onClick={() => openGoodsSearch()}
        >
          <Image className='affiliate-home__search-icon' src={require('../../assets/community/topbar-search.svg')} mode='aspectFit' />
          <Text>搜商品、优惠券</Text>
        </View>
        <View
          className='affiliate-home__paste'
          ariaRole='button'
          ariaLabel='粘贴淘宝链接查券'
          onClick={() => openGoodsSearch('resolve')}
        >
          <Text>粘贴查券</Text>
        </View>
      </View>

      <View className='affiliate-home__hero'>
        <View className='affiliate-home__hero-copy'>
          <Text className='affiliate-home__hero-eyebrow'>Campus 好物</Text>
          <Text className='affiliate-home__hero-title'>校园实用好物</Text>
          <Text className='affiliate-home__hero-note'>精选推荐 · 购买前核验优惠</Text>
        </View>
        <View className='affiliate-home__hero-art'>
          <View className='affiliate-home__hero-bag' />
          <View className='affiliate-home__hero-spark affiliate-home__hero-spark--one' />
          <View className='affiliate-home__hero-spark affiliate-home__hero-spark--two' />
        </View>
      </View>

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
            <View className='affiliate-home__retry' ariaRole='button' onClick={() => openGoodsSearch()}>
              搜索商品
            </View>
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
            />
          ))}
        </View>
        {loadingMore && <View className='affiliate-home__load-more' ariaRole='status'>正在加载更多…</View>}
        {!loadingMore && products.length > 0 && products.length < total && (
          <View className='affiliate-home__load-more'>继续上滑查看更多</View>
        )}
        {!loadingMore && products.length > 0 && products.length >= total && (
          <View className='affiliate-home__load-more'>已经到底了</View>
        )}
      </View>

      {purchaseProduct && (
        <CouponPurchaseSheet product={purchaseProduct} onClose={() => setPurchaseProduct(null)} />
      )}
    </View>
  )
}
