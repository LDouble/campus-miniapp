import { useCallback, useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { Image, ScrollView, Text, View } from '@tarojs/components'
import { isApiError } from '../../../api/client'
import {
  listAffiliateRankings,
  type AffiliateRankingCategory,
  type AffiliateRankingItem,
} from '../../../api/affiliate'
import type { AffiliatePurchaseProduct } from '../components/product-card'
import AffiliateProductCard from '../components/product-card'
import { cacheAffiliateGoods } from '../session-cache'
import {
  AffiliateRankingRequestCoordinator,
  appendUniqueAffiliateRankingItems,
  getAffiliateRankingCategoryState,
  getAffiliateRankingCategoryTimestamp,
  getAffiliateRankingSnapshotRestart,
  hasMoreAffiliateRankingPages,
  sortAffiliateRankingCategories,
} from './policy'
import './ranking-section.scss'

const PAGE_SIZE = 20

const rankingCategoryIcons: Record<number, string> = {
  4: require('../../../assets/affiliate/category-home.svg'),
  6: require('../../../assets/affiliate/category-food.svg'),
  3: require('../../../assets/affiliate/category-beauty.svg'),
  1: require('../../../assets/affiliate/category-women.svg'),
  14: require('../../../assets/affiliate/category-home-textile.svg'),
  5: require('../../../assets/affiliate/category-shoe.svg'),
  9: require('../../../assets/affiliate/category-men.svg'),
  12: require('../../../assets/affiliate/category-accessories.svg'),
  13: require('../../../assets/affiliate/category-outdoor.svg'),
}

type AffiliateRankingSectionProps = {
  active: boolean
  capabilityEnabled: boolean
  canConvert: boolean
  refreshToken: number
  onEnabledChange: (enabled: boolean | null) => void
  onBuy: (product: AffiliatePurchaseProduct) => void
}

type AffiliateRankingSectionState = {
  enabled: boolean | null
  phase: 'idle' | 'loading' | 'ready' | 'error'
  items: AffiliateRankingItem[]
  categories: AffiliateRankingCategory[]
  total: number
  page: number
  pageSize: number
  snapshotId: string
  error: string
  loadMoreError: string
  loadingMore: boolean
}

const emptyState = (): AffiliateRankingSectionState => ({
  enabled: null,
  phase: 'idle',
  items: [],
  categories: [],
  total: 0,
  page: 0,
  pageSize: PAGE_SIZE,
  snapshotId: '',
  error: '',
  loadMoreError: '',
  loadingMore: false,
})

const formatSyncTime = (value: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  return `最近同步 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const statusText: Record<ReturnType<typeof getAffiliateRankingCategoryState>, string> = {
  ready: '',
  stale: '榜单更新稍慢，当前展示最近一次可用数据',
  pending: '榜单正在准备中，请稍后重试',
  failed: '该分类榜单暂时同步失败',
  partial: '部分分类暂未更新，当前展示可用榜单',
  empty: '',
}

export default function AffiliateRankingSection({
  active,
  capabilityEnabled,
  canConvert,
  refreshToken,
  onEnabledChange,
  onBuy,
}: AffiliateRankingSectionProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | undefined>()
  const [state, setState] = useState<AffiliateRankingSectionState>(emptyState)
  const stateRef = useRef(state)
  const selectedCategoryRef = useRef<number | undefined>()
  const scopeRef = useRef({ active, capabilityEnabled })
  const coordinatorRef = useRef(new AffiliateRankingRequestCoordinator())
  const loadedRef = useRef(false)
  const previousRefreshToken = useRef(refreshToken)

  scopeRef.current = { active, capabilityEnabled }
  selectedCategoryRef.current = selectedCategoryId

  const commit = useCallback((next: AffiliateRankingSectionState) => {
    stateRef.current = next
    setState(next)
  }, [])

  const loadPage = useCallback(async (
    page: number,
    categoryId: number | undefined,
    reset = false,
    snapshotId?: string,
  ) => {
    if (!scopeRef.current.active || !scopeRef.current.capabilityEnabled) return

    const coordinator = coordinatorRef.current
    const requestIdentity = coordinator.begin(categoryId, page)
    const previous = stateRef.current
    const base = {
      ...previous,
      enabled: page === 1 && previous.enabled === false ? null : previous.enabled,
      ...(reset ? {
        items: [],
        total: 0,
        page: 0,
        snapshotId: '',
        loadMoreError: '',
      } : {}),
    }
    commit({
      ...base,
      phase: 'loading',
      error: '',
      loadMoreError: '',
      loadingMore: page > 1,
    })

    try {
      const result = await listAffiliateRankings({
        category_id: categoryId,
        page,
        page_size: PAGE_SIZE,
        snapshot_id: page > 1 ? snapshotId : undefined,
      })
      if (!coordinator.isCurrent(requestIdentity)) return
      if (!result.enabled) {
        loadedRef.current = false
        coordinator.invalidate()
        onEnabledChange(false)
        commit({ ...emptyState(), enabled: false, phase: 'ready' })
        return
      }
      onEnabledChange(true)

      const categories = sortAffiliateRankingCategories(result.categories)
      if (categoryId !== undefined && !categories.some((item) => item.id === categoryId)) {
        selectedCategoryRef.current = undefined
        setSelectedCategoryId(undefined)
        loadedRef.current = false
        void loadPage(1, undefined, true)
        return
      }

      const currentSnapshotId = stateRef.current.snapshotId
      if (page > 1 && currentSnapshotId && result.snapshot_id !== currentSnapshotId) {
        loadedRef.current = false
        void loadPage(1, categoryId, true)
        return
      }

      const items = page === 1
        ? appendUniqueAffiliateRankingItems([], result.items)
        : appendUniqueAffiliateRankingItems(stateRef.current.items, result.items)
      loadedRef.current = true
      commit({
        enabled: true,
        phase: 'ready',
        items,
        categories,
        total: result.total,
        page: result.page,
        pageSize: result.page_size || PAGE_SIZE,
        snapshotId: result.snapshot_id,
        error: '',
        loadMoreError: '',
        loadingMore: false,
      })
    } catch (error) {
      if (!coordinator.isCurrent(requestIdentity)) return
      const statusCode = isApiError(error) ? error.statusCode : undefined
      const restart = getAffiliateRankingSnapshotRestart(page, categoryId, statusCode)
      if (restart) {
        loadedRef.current = false
        void loadPage(restart.page, restart.categoryId, true)
        return
      }
      const message = error instanceof Error ? error.message : '热销榜加载失败，请稍后重试。'
      commit({
        ...stateRef.current,
        phase: page === 1 && !stateRef.current.items.length ? 'error' : 'ready',
        error: page === 1 ? message : '',
        loadMoreError: page > 1 ? message : '',
        loadingMore: false,
      })
    } finally {
      if (coordinator.isCurrent(requestIdentity)) {
        const latest = stateRef.current
        if (latest.loadingMore || latest.phase === 'loading') {
          commit({ ...latest, phase: latest.phase === 'loading' ? 'ready' : latest.phase, loadingMore: false })
        }
      }
    }
  }, [commit, onEnabledChange])

  useEffect(() => {
    const coordinator = coordinatorRef.current
    coordinator.setScope(active, capabilityEnabled)
    if (!active || !capabilityEnabled) {
      if (!capabilityEnabled) {
        loadedRef.current = false
        onEnabledChange(null)
        commit(emptyState())
      } else {
        const latest = stateRef.current
        commit({
          ...latest,
          phase: latest.items.length ? 'ready' : 'idle',
          loadingMore: false,
          loadMoreError: '',
        })
      }
      return
    }

    const refreshRequested = previousRefreshToken.current !== refreshToken
    previousRefreshToken.current = refreshToken
    if (refreshRequested || !loadedRef.current) {
      void loadPage(1, selectedCategoryRef.current, false)
    }
  }, [active, capabilityEnabled, commit, loadPage, onEnabledChange, refreshToken])

  useEffect(() => () => coordinatorRef.current.invalidate(), [])

  const chooseCategory = (categoryId: number | undefined) => {
    if (categoryId === selectedCategoryRef.current && stateRef.current.phase === 'loading') return
    selectedCategoryRef.current = categoryId
    setSelectedCategoryId(categoryId)
    loadedRef.current = false
    void loadPage(1, categoryId, true)
  }

  const retry = () => {
    if (active && capabilityEnabled) void loadPage(1, selectedCategoryRef.current, false)
  }

  const loadMore = () => {
    const current = stateRef.current
    if (!active || !capabilityEnabled || current.phase === 'loading' || current.loadingMore) return
    if (!hasMoreAffiliateRankingPages(current.page, current.pageSize, current.total)) return
    if (!current.snapshotId) return
    void loadPage(current.page + 1, selectedCategoryRef.current, false, current.snapshotId)
  }

  const retryMore = () => {
    const current = stateRef.current
    if (!current.loadMoreError || !current.snapshotId || current.loadingMore) return
    void loadPage(current.page + 1, selectedCategoryRef.current, false, current.snapshotId)
  }

  if (!capabilityEnabled || state.enabled === false) return null

  const categories = sortAffiliateRankingCategories(state.categories)
  const categoryState = getAffiliateRankingCategoryState(categories, selectedCategoryId)
  const status = statusText[categoryState]
  const syncedAt = formatSyncTime(getAffiliateRankingCategoryTimestamp(categories, selectedCategoryId))
  const hasMore = hasMoreAffiliateRankingPages(state.page, state.pageSize, state.total)

  return (
    <View className='affiliate-ranking'>
      {state.enabled && categories.length > 0 && (
        <ScrollView className='affiliate-ranking__category-scroll' scrollX enhanced showScrollbar={false}>
          <View className='affiliate-ranking__category-list'>
            <View
              className={`affiliate-ranking__category ${selectedCategoryId === undefined ? 'affiliate-ranking__category--active' : ''}`}
              ariaRole='button'
              ariaLabel='查看综合热销榜'
              onClick={() => chooseCategory(undefined)}
            >
              <Image
                className='affiliate-ranking__category-icon'
                src={selectedCategoryId === undefined
                  ? require('../../../assets/affiliate/category-featured.svg')
                  : require('../../../assets/affiliate/category-comprehensive.svg')}
                mode='aspectFit'
              />
              <Text>综合</Text>
            </View>
            {categories.map((category) => (
              <View
                key={category.id}
                className={`affiliate-ranking__category ${selectedCategoryId === category.id ? 'affiliate-ranking__category--active' : ''}`}
                ariaRole='button'
                ariaLabel={`查看${category.name}热销榜`}
                onClick={() => chooseCategory(category.id)}
              >
                <Image
                  className='affiliate-ranking__category-icon'
                  src={rankingCategoryIcons[category.id]}
                  mode='aspectFit'
                />
                <Text>{category.name}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      <View className='affiliate-home__section-heading affiliate-ranking__heading'>
        <View className='affiliate-ranking__heading-main'>
          <Text>为你推荐</Text>
          {state.enabled && <Text className='affiliate-ranking__window'>近2小时热销</Text>}
        </View>
        {syncedAt && <Text>{syncedAt}</Text>}
      </View>

      {state.phase === 'loading' && state.items.length === 0 && (
        <View className='affiliate-ranking__state' ariaRole='status'>正在加载热销商品…</View>
      )}
      {state.error && (
        <View className='affiliate-ranking__state affiliate-ranking__state--error' ariaRole='alert'>
          <Text>{state.error}</Text>
          <View className='affiliate-home__retry' ariaRole='button' onClick={retry}>重新加载</View>
        </View>
      )}
      {state.enabled && status && (
        <View className={`affiliate-ranking__notice affiliate-ranking__notice--${categoryState}`} ariaRole='status'>
          <Text>{status}</Text>
          {(categoryState === 'pending' || categoryState === 'failed' || categoryState === 'stale' || categoryState === 'partial') && (
            <View className='affiliate-ranking__retry' ariaRole='button' onClick={retry}>刷新榜单</View>
          )}
        </View>
      )}

      {state.enabled && state.items.length > 0 && (
        <View className='affiliate-home__product-list affiliate-ranking__product-list'>
          {state.items.map((item) => (
            <AffiliateProductCard
              key={item.goods.goods_id}
              product={item.goods}
              recommendation
              layout='tile'
              clockRefreshKey={active}
              salesLabel={item.two_hours_sales === null
                ? undefined
                : `2小时售${item.two_hours_sales}`}
              onOpen={() => {
                cacheAffiliateGoods(item.goods)
                Taro.navigateTo({ url: `/pages/goods/detail?goods_id=${encodeURIComponent(item.goods.goods_id)}` })
              }}
              onBuy={onBuy}
              canConvert={canConvert}
            />
          ))}
        </View>
      )}
      {state.enabled && state.items.length > 0 && (
        <Text className='affiliate-ranking__source'>数据来自大淘客榜单</Text>
      )}

      {state.enabled && state.phase !== 'loading' && !state.error && state.items.length === 0 && categoryState === 'ready' && (
        <View className='affiliate-ranking__state'>这个分类暂时没有热销商品</View>
      )}
      {state.enabled && state.phase !== 'loading' && !state.error && state.items.length === 0 && categoryState === 'empty' && (
        <View className='affiliate-ranking__state'>暂无可展示的热销分类</View>
      )}
      {state.enabled && state.loadingMore && (
        <View className='affiliate-ranking__load-more' ariaRole='status'>正在加载更多热销商品…</View>
      )}
      {state.enabled && state.loadMoreError && (
        <View className='affiliate-ranking__load-more affiliate-ranking__load-more--error' ariaRole='alert'>
          <Text>{state.loadMoreError}</Text>
          <View className='affiliate-ranking__retry' ariaRole='button' onClick={retryMore}>重试加载</View>
        </View>
      )}
      {state.enabled && hasMore && !state.loadingMore && !state.loadMoreError && (
        <View className='affiliate-ranking__load-more affiliate-ranking__load-more--button' ariaRole='button' onClick={loadMore}>加载更多热销商品</View>
      )}
      {state.enabled && state.page > 0 && !hasMore && state.items.length > 0 && (
        <View className='affiliate-ranking__load-more'>热销榜已加载完</View>
      )}
    </View>
  )
}
