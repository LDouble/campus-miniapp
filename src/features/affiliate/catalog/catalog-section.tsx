import { useCallback, useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { Image, ScrollView, Text, View } from '@tarojs/components'
import { isApiError } from '../../../api/client'
import {
  listAffiliateCatalog,
  type AffiliateCatalogGroup,
  type AffiliateCatalogGroupKey,
  type AffiliateCatalogItem,
  type AffiliateCatalogPage,
} from '../../../api/affiliate'
import type { AffiliatePurchaseProduct } from '../components/product-card'
import AffiliateProductCard from '../components/product-card'
import { cacheAffiliateGoods } from '../session-cache'
import {
  AffiliateCatalogRequestCoordinator,
  appendUniqueAffiliateCatalogItems,
  formatAffiliateCatalogMonthSales,
  getAffiliateCatalogSnapshotRestart,
  hasMoreAffiliateCatalogPages,
  sortAffiliateCatalogDailyTags,
} from './policy'
import './catalog-section.scss'

const PAGE_SIZE = 20

const groupTabs: Array<{
  key?: AffiliateCatalogGroupKey
  name: string
  icon: string
}> = [
  { name: '综合', icon: require('../../../assets/affiliate/category-comprehensive.svg') },
  { key: 'food', name: '美食', icon: require('../../../assets/affiliate/category-food.svg') },
  { key: 'beauty', name: '美妆', icon: require('../../../assets/affiliate/category-beauty.svg') },
  { key: 'daily', name: '日用', icon: require('../../../assets/affiliate/category-home.svg') },
]

type AffiliateCatalogSectionProps = {
  active: boolean
  capabilityEnabled: boolean
  canConvert: boolean
  initialPage: AffiliateCatalogPage
  onDisabled: () => void
  onBuy: (product: AffiliatePurchaseProduct) => void
}

type CatalogSectionState = {
  phase: 'idle' | 'loading' | 'ready' | 'error'
  group?: AffiliateCatalogGroupKey
  items: AffiliateCatalogItem[]
  groups: AffiliateCatalogGroup[]
  tags: AffiliateCatalogPage['tags']
  total: number
  page: number
  pageSize: number
  snapshotId: string
  error: string
  loadMoreError: string
  loadingMore: boolean
}

const stateFromPage = (page: AffiliateCatalogPage): CatalogSectionState => ({
  phase: 'ready',
  items: page.items,
  groups: page.groups,
  tags: page.tags,
  total: page.total,
  page: page.page,
  pageSize: page.page_size || PAGE_SIZE,
  snapshotId: page.snapshot_id,
  error: '',
  loadMoreError: '',
  loadingMore: false,
})

const emptyState = (): CatalogSectionState => ({
  phase: 'idle',
  items: [],
  groups: [],
  tags: [],
  total: 0,
  page: 0,
  pageSize: PAGE_SIZE,
  snapshotId: '',
  error: '',
  loadMoreError: '',
  loadingMore: false,
})

const getGroupByKey = (groups: AffiliateCatalogGroup[], key: AffiliateCatalogGroupKey) => (
  groups.find((group) => group.key === key)
)

/** AffiliateCatalogSection 展示后台同步的商品库分类、日用标签和月销量。 */
export default function AffiliateCatalogSection({
  active,
  capabilityEnabled,
  canConvert,
  initialPage,
  onDisabled,
  onBuy,
}: AffiliateCatalogSectionProps) {
  const [selectedGroup, setSelectedGroup] = useState<AffiliateCatalogGroupKey | undefined>()
  const [selectedTag, setSelectedTag] = useState<string | undefined>()
  const [state, setState] = useState<CatalogSectionState>(() => stateFromPage(initialPage))
  const stateRef = useRef(state)
  const selectedGroupRef = useRef<AffiliateCatalogGroupKey | undefined>()
  const selectedTagRef = useRef<string | undefined>()
  const scopeRef = useRef({ active, capabilityEnabled })
  const coordinatorRef = useRef(new AffiliateCatalogRequestCoordinator())
  const loadedRef = useRef(true)

  scopeRef.current = { active, capabilityEnabled }
  selectedGroupRef.current = selectedGroup
  selectedTagRef.current = selectedTag

  const commit = useCallback((next: CatalogSectionState) => {
    stateRef.current = next
    setState(next)
  }, [])

  const isCurrent = useCallback((identity: ReturnType<AffiliateCatalogRequestCoordinator['begin']>) => (
    scopeRef.current.active
      && scopeRef.current.capabilityEnabled
      && coordinatorRef.current.isCurrent(identity)
  ), [])

  const loadPage = useCallback(async (
    page: number,
    group: AffiliateCatalogGroupKey | undefined,
    tag: string | undefined,
    reset = false,
    snapshotId?: string,
  ) => {
    if (!scopeRef.current.active || !scopeRef.current.capabilityEnabled) return

    const coordinator = coordinatorRef.current
    const requestIdentity = coordinator.begin(group, tag, page)
    const previous = stateRef.current
    const keepDailyTags = group === 'daily' && previous.group === 'daily'
    commit({
      ...previous,
      phase: 'loading',
      group,
      ...(reset ? {
        items: [],
        total: 0,
        page: 0,
        snapshotId: '',
        loadMoreError: '',
        tags: keepDailyTags ? previous.tags : [],
      } : {}),
      error: '',
      loadMoreError: '',
      loadingMore: page > 1,
    })

    try {
      const result = await listAffiliateCatalog({
        group,
        tag,
        page,
        page_size: PAGE_SIZE,
        snapshot_id: page > 1 ? snapshotId : undefined,
      })
      if (!isCurrent(requestIdentity)) return
      if (!result.enabled) {
        loadedRef.current = false
        coordinator.invalidate()
        onDisabled()
        return
      }

      const currentSnapshotId = stateRef.current.snapshotId
      if (page > 1 && currentSnapshotId && result.snapshot_id !== currentSnapshotId) {
        loadedRef.current = false
        void loadPage(1, group, tag, true)
        return
      }

      const items = page === 1
        ? appendUniqueAffiliateCatalogItems([], result.items)
        : appendUniqueAffiliateCatalogItems(stateRef.current.items, result.items)
      loadedRef.current = true
      commit({
        phase: 'ready',
        group,
        items,
        groups: result.groups,
        tags: result.tags,
        total: result.total,
        page: result.page,
        pageSize: result.page_size || PAGE_SIZE,
        snapshotId: result.snapshot_id,
        error: '',
        loadMoreError: '',
        loadingMore: false,
      })
    } catch (loadError) {
      if (!isCurrent(requestIdentity)) return
      const restart = getAffiliateCatalogSnapshotRestart(
        page,
        group,
        tag,
        isApiError(loadError) ? loadError.statusCode : undefined,
        isApiError(loadError) ? loadError.code : undefined,
      )
      if (restart) {
        loadedRef.current = false
        void loadPage(restart.page, restart.group, restart.tag, true)
        return
      }
      const message = loadError instanceof Error ? loadError.message : '商品加载失败，请稍后重试。'
      commit({
        ...stateRef.current,
        phase: page === 1 ? 'error' : 'ready',
        error: page === 1 ? message : '',
        loadMoreError: page > 1 ? message : '',
        loadingMore: false,
      })
    } finally {
      if (isCurrent(requestIdentity)) {
        const latest = stateRef.current
        if (latest.loadingMore || latest.phase === 'loading') {
          commit({
            ...latest,
            phase: latest.phase === 'loading' ? 'ready' : latest.phase,
            loadingMore: false,
          })
        }
      }
    }
  }, [commit, isCurrent, onDisabled])

  useEffect(() => {
    const coordinator = coordinatorRef.current
    coordinator.setScope(active, capabilityEnabled)
    if (!active || !capabilityEnabled) {
      if (!capabilityEnabled) {
        loadedRef.current = false
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
    if (!loadedRef.current) {
      void loadPage(1, selectedGroupRef.current, selectedTagRef.current, true)
    }
  }, [active, capabilityEnabled, commit, loadPage])

  useEffect(() => () => coordinatorRef.current.invalidate(), [])

  const chooseGroup = (group?: AffiliateCatalogGroupKey) => {
    if (group === selectedGroupRef.current && stateRef.current.phase === 'loading') return
    selectedGroupRef.current = group
    selectedTagRef.current = undefined
    setSelectedGroup(group)
    setSelectedTag(undefined)
    loadedRef.current = false
    void loadPage(1, group, undefined, true)
  }

  const chooseTag = (tag?: string) => {
    if (tag === selectedTagRef.current && stateRef.current.phase === 'loading') return
    selectedGroupRef.current = 'daily'
    selectedTagRef.current = tag
    setSelectedGroup('daily')
    setSelectedTag(tag)
    loadedRef.current = false
    void loadPage(1, 'daily', tag, true)
  }

  const retry = () => {
    if (active && capabilityEnabled) {
      loadedRef.current = false
      void loadPage(1, selectedGroupRef.current, selectedTagRef.current, true)
    }
  }

  const loadMore = () => {
    const current = stateRef.current
    if (!active || !capabilityEnabled || current.phase === 'loading' || current.loadingMore) return
    if (!hasMoreAffiliateCatalogPages(current.page, current.pageSize, current.total) || !current.snapshotId) return
    void loadPage(current.page + 1, selectedGroupRef.current, selectedTagRef.current, false, current.snapshotId)
  }

  const retryMore = () => {
    const current = stateRef.current
    if (!current.loadMoreError || !current.snapshotId || current.loadingMore) return
    void loadPage(current.page + 1, selectedGroupRef.current, selectedTagRef.current, false, current.snapshotId)
  }

  if (!active || !capabilityEnabled) return null

  const dailyGroup = getGroupByKey(state.groups, 'daily')
  const dailyTags = sortAffiliateCatalogDailyTags(state.tags)
  const hasMore = hasMoreAffiliateCatalogPages(state.page, state.pageSize, state.total)

  return (
    <View className='affiliate-ranking affiliate-catalog'>
      <ScrollView className='affiliate-ranking__category-scroll' scrollX enhanced showScrollbar={false}>
        <View className='affiliate-ranking__category-list'>
          {groupTabs.map((tab) => {
            const group = tab.key ? getGroupByKey(state.groups, tab.key) : undefined
            const name = tab.key ? group?.name || tab.name : tab.name
            const activeTab = selectedGroup === tab.key
            return (
              <View
                key={tab.key || 'all'}
                className={`affiliate-ranking__category ${activeTab ? 'affiliate-ranking__category--active' : ''}`}
                ariaRole='button'
                ariaLabel={`查看${name}商品`}
                onClick={() => chooseGroup(tab.key)}
              >
                <Image
                  className='affiliate-ranking__category-icon'
                  src={activeTab && !tab.key
                    ? require('../../../assets/affiliate/category-featured.svg')
                    : tab.icon}
                  mode='aspectFit'
                />
                <Text>{name}</Text>
                {group && <Text className='affiliate-catalog__group-count'>{group.count}</Text>}
              </View>
            )
          })}
        </View>
      </ScrollView>

      {selectedGroup === 'daily' && (
        <ScrollView className='affiliate-catalog__tag-scroll' scrollX enhanced showScrollbar={false}>
          <View className='affiliate-catalog__tag-list'>
            <View
              className={`affiliate-catalog__tag ${selectedTag === undefined ? 'affiliate-catalog__tag--active' : ''}`}
              ariaRole='button'
              ariaLabel={`日用全部，${dailyGroup?.count ?? 0}件商品`}
              onClick={() => chooseTag(undefined)}
            >
              <Text>全部</Text>
              <Text className='affiliate-catalog__tag-count'>{dailyGroup?.count ?? 0}</Text>
            </View>
            {dailyTags.map((tag) => (
              <View
                key={tag.key}
                className={`affiliate-catalog__tag ${selectedTag === tag.key ? 'affiliate-catalog__tag--active' : ''}`}
                ariaRole='button'
                ariaLabel={`${tag.name}，${tag.count}件商品`}
                onClick={() => chooseTag(tag.key)}
              >
                <Text>{tag.name}</Text>
                <Text className='affiliate-catalog__tag-count'>{tag.count}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      <View className='affiliate-home__section-heading affiliate-ranking__heading'>
        <View className='affiliate-ranking__heading-main'>
          <Text>为你推荐</Text>
        </View>
        {state.phase === 'ready' && <Text>{state.total} 件商品</Text>}
      </View>

      {state.phase === 'loading' && state.items.length === 0 && (
        <View className='affiliate-ranking__state' ariaRole='status'>正在为你挑选好物…</View>
      )}
      {state.error && (
        <View className='affiliate-ranking__state affiliate-ranking__state--error' ariaRole='alert'>
          <Text>{state.error}</Text>
          <View className='affiliate-home__retry' ariaRole='button' onClick={retry}>重新加载</View>
        </View>
      )}

      {state.items.length > 0 && (
        <View className='affiliate-home__product-list affiliate-ranking__product-list'>
          {state.items.map((item) => (
            <AffiliateProductCard
              key={item.goods.goods_id}
              product={item.goods}
              recommendation
              layout='tile'
              salesLabel={formatAffiliateCatalogMonthSales(item.month_sales)}
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

      {state.phase !== 'loading' && !state.error && state.items.length === 0 && (
        <View className='affiliate-ranking__state'>这个分类暂时没有商品</View>
      )}
      {state.loadingMore && (
        <View className='affiliate-ranking__load-more' ariaRole='status'>正在加载更多商品…</View>
      )}
      {state.loadMoreError && (
        <View className='affiliate-ranking__load-more affiliate-ranking__load-more--error' ariaRole='alert'>
          <Text>{state.loadMoreError}</Text>
          <View className='affiliate-ranking__retry' ariaRole='button' onClick={retryMore}>重试加载</View>
        </View>
      )}
      {hasMore && !state.loadingMore && !state.loadMoreError && state.phase === 'ready' && (
        <View className='affiliate-ranking__load-more affiliate-ranking__load-more--button' ariaRole='button' onClick={loadMore}>加载更多商品</View>
      )}
      {!hasMore && state.page > 0 && state.items.length > 0 && (
        <View className='affiliate-ranking__load-more'>已经到底了</View>
      )}
    </View>
  )
}
