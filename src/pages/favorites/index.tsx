import { useCallback, useRef, useState } from 'react'
import Taro, {
  useDidShow,
  useLoad,
  usePullDownRefresh,
  useReachBottom,
} from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import type { FavoriteItem } from '../../api/types'
import { listMyFavorites } from '../../api/favorites'
import { isApiError } from '../../api/client'
import CustomNavbar from '../../components/custom-navbar'
import FavoriteCard from '../../features/favorites/favorite-card'
import { hasMoreFavoriteItems, mergeFavoriteItems } from '../../features/favorites/list-state'
import './index.scss'

const FAVORITES_PAGE_SIZE = 20

type LoadMode = 'initial' | 'refresh' | 'more'

export default function FavoritesPage() {
  const [items, setItems] = useState<FavoriteItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const pageRef = useRef(0)
  const totalRef = useRef(0)
  const loadingRef = useRef(false)
  const requestVersionRef = useRef(0)
  const firstDidShowRef = useRef(true)

  const loadPage = useCallback(async (targetPage: number, mode: LoadMode) => {
    if (loadingRef.current) return
    if (mode === 'more' && (pageRef.current === 0 || !hasMoreFavoriteItems(items.length, totalRef.current))) return

    loadingRef.current = true
    const requestVersion = requestVersionRef.current + 1
    requestVersionRef.current = requestVersion
    if (mode === 'initial') setLoading(true)
    if (mode === 'refresh') setRefreshing(true)
    if (mode !== 'more') setError('')

    try {
      const result = await listMyFavorites({ page: targetPage, pageSize: FAVORITES_PAGE_SIZE })
      if (requestVersion !== requestVersionRef.current) return
      pageRef.current = result.page
      totalRef.current = result.total
      setTotal(result.total)
      setItems((current) => mode === 'more' ? mergeFavoriteItems(current, result.items) : result.items)
    } catch (loadError) {
      if (requestVersion !== requestVersionRef.current) return
      setError(isApiError(loadError) ? loadError.message : '收藏列表加载失败，请稍后重试')
    } finally {
      if (requestVersion === requestVersionRef.current) {
        setLoading(false)
        setRefreshing(false)
        setLoadingMore(false)
      }
      loadingRef.current = false
      Taro.stopPullDownRefresh()
    }
  }, [items.length])

  useLoad(() => {
    void loadPage(1, 'initial')
  })

  useDidShow(() => {
    if (firstDidShowRef.current) {
      firstDidShowRef.current = false
      return
    }
    if (pageRef.current > 0) void loadPage(1, 'refresh')
  })

  usePullDownRefresh(() => {
    void loadPage(1, 'refresh')
  })

  useReachBottom(() => {
    if (loadingRef.current || !hasMoreFavoriteItems(items.length, totalRef.current)) return
    setLoadingMore(true)
    void loadPage(pageRef.current + 1, 'more')
  })

  const removeItem = (item: FavoriteItem) => {
    setItems((current) => current.filter((candidate) => (
      candidate.resource_type !== item.resource_type || candidate.resource_id !== item.resource_id
    )))
    totalRef.current = Math.max(0, totalRef.current - 1)
    setTotal(totalRef.current)
  }

  const hasItems = items.length > 0
  const showInitialState = loading && !hasItems
  const showEmptyState = !loading && !error && !hasItems

  return (
    <View className='favorites-page'>
      <CustomNavbar title='我的收藏' showBack />
      <View className='favorites-page__content'>
        <View className='favorites-page__intro'>
          <View>
            <Text className='favorites-page__eyebrow'>CAMPUS COLLECTION</Text>
            <Text className='favorites-page__title'>把重要的校园内容留在这里</Text>
          </View>
          <Text className='favorites-page__count'>{total} 条</Text>
        </View>

        {refreshing && <View className='favorites-page__refreshing'>正在刷新收藏</View>}
        {showInitialState && <View className='favorites-page__state'>正在加载收藏</View>}
        {!showInitialState && error && !hasItems && (
          <View className='favorites-page__state favorites-page__state--error' onClick={() => void loadPage(1, 'initial')}>
            <Text>{error}</Text>
            <Text>点击重试</Text>
          </View>
        )}
        {showEmptyState && (
          <View className='favorites-page__empty'>
            <View className='favorites-page__empty-icon'>
              <View className='favorites-page__empty-bookmark' />
            </View>
            <Text className='favorites-page__empty-title'>还没有收藏内容</Text>
            <Text className='favorites-page__empty-copy'>在动态、二手、跑腿或找同行详情里点击收藏，之后可以从这里快速找回。</Text>
          </View>
        )}
        {error && hasItems && (
          <View className='favorites-page__inline-error' onClick={() => void loadPage(1, 'refresh')}>
            <Text>{error}</Text>
            <Text>点击重试</Text>
          </View>
        )}
        {hasItems && (
          <View className='favorites-page__list'>
            {items.map((item) => (
              <FavoriteCard
                key={`${item.resource_type}:${item.resource_id}`}
                item={item}
                onRemoved={removeItem}
              />
            ))}
          </View>
        )}
        {loadingMore && <View className='favorites-page__loading-more'>正在加载更多</View>}
        {hasItems && !loading && !loadingMore && !hasMoreFavoriteItems(items.length, total) && (
          <View className='favorites-page__end'>已经到底了</View>
        )}
      </View>
    </View>
  )
}
