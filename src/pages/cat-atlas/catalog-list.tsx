import { Image, Text, View } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'
import CustomNavbar from '../../components/custom-navbar'
import { listCats, setCatFavorite, type CatSort, type CatView } from '../../api/cat-atlas'
import { CatCover, RequestState } from '../../features/cat-atlas/ui'
import { KeyboardSafeInput } from '../../components/keyboard-safe-input'
import { useCollapsingHeader } from '../../hooks/use-collapsing-header'
import { navigateToWithGuard } from '../../utils/navigation'
import './home-list.scss'
import './warm-theme.scss'

const searchIcon = require('../../assets/icons/search.svg')
const locationIcon = require('../../assets/icons/location-warm.svg')
const plusIcon = require('../../assets/icons/plus.svg')
const heartIcon = require('../../assets/community/heart.svg')
const heroImage = require('../../assets/cat-atlas/stitch/list-1.jpg')

const areas = ['全部', '崂山校区', '鱼山校区', '西海岸校区']
const sortOptions = ['按遇见次数', '最近遇见', '最新收录']
const PAGE_SIZE = 30
const tagClass = (index: number) => ['cat-list-v2__tag--blue', 'cat-list-v2__tag--mint', 'cat-list-v2__tag--orange'][index % 3]

type LoadOptions = { page?: number; append?: boolean }

export default function CatAtlasCatalogList() {
  const [items, setItems] = useState<CatView[]>([])
  const [total, setTotal] = useState(0)
  const [areaCounts, setAreaCounts] = useState<number[]>(() => areas.map(() => 0))
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
  const headerCollapsed = useCollapsingHeader({ threshold: 180, releaseGap: 28 })

  const load = useCallback(async ({ page: requestedPage = 1, append = false }: LoadOptions = {}) => {
    if (append && (loadingMoreRef.current || !hasMoreRef.current)) return

    const version = requestVersion.current + 1
    requestVersion.current = version
    if (append) {
      loadingMoreRef.current = true
      setLoadingMore(true)
    } else {
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
      const result = await listCats({ keyword: query, area: area === '全部' ? undefined : area, sort: sortValue, page: requestedPage, pageSize: PAGE_SIZE })
      if (version !== requestVersion.current) return

      setItems((current) => {
        if (!append) return result.items
        const merged = new Map(current.map((item) => [item.id, item]))
        result.items.forEach((item) => merged.set(item.id, item))
        return Array.from(merged.values())
      })
      setTotal(result.total)
      setPage(result.page)
      hasMoreRef.current = result.page * result.page_size < result.total
      setHasMore(hasMoreRef.current)

      if (!append) {
        const countAreas = [undefined, ...areas.slice(1)]
        const areaTotals = await Promise.all(countAreas.map(async (campus) => {
          try {
            const campusPage = await listCats({ keyword: query, area: campus, sort: sortValue, page: 1, pageSize: 1 })
            return campusPage.total
          } catch {
            return null
          }
        }))
        if (version !== requestVersion.current) return
        setAreaCounts(areaTotals.map((count, index) => count ?? (index === 0 ? result.total : result.items.filter((cat) => cat.campus === areas[index]).length)))
      }
    } catch (loadError) {
      if (version !== requestVersion.current) return
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

  const loadMore = useCallback(() => {
    if (loading || loadingMoreRef.current || !hasMoreRef.current) return
    void load({ page: page + 1, append: true })
  }, [load, loading, page])

  useEffect(() => {
    if (hasShownRef.current) void load()
  }, [load])

  useDidShow(() => {
    hasShownRef.current = true
    void load()
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

  const changeSort = (value: string) => { setSort(value); setSortOpen(false) }

  return <View className='cat-list-page'>
    <CustomNavbar title='全部图鉴' showBack theme='ocean' immersive={!headerCollapsed} collapsed={headerCollapsed} />
    <View className='cat-list-page__scroll'>
      <View className='cat-list-v2__hero'><Image src={heroImage} className='cat-list-v2__hero-image' mode='aspectFill' /><View className='cat-list-v2__hero-veil' /><View className='cat-list-v2__hero-badge'><Text>OUC 海大萌宠档案库</Text><View /><Text>共 3 个校区</Text></View><View className='cat-list-v2__hero-copy'><Text>记录海大的每一次偶遇</Text><Text>遇见身边毛绒绒的温暖与心动</Text></View></View>
      <View className='cat-list-v2__search'><Image src={searchIcon} mode='aspectFit' /><KeyboardSafeInput value={keyword} placeholder='搜索猫咪名字 / 地点 / 毛色特征…' confirmType='search' onInput={(event) => setKeyword(event.detail.value)} onConfirm={submitSearch} /><Text onClick={submitSearch}>搜索</Text></View>
      <View className='cat-list-v2__filters'>{areas.map((item, index) => <Text key={item} className={area === item ? 'is-active' : ''} onClick={() => setArea(item)}>{item}<Text>{areaCounts[index]}</Text></Text>)}</View>
      <View className='cat-list-v2__toolbar'><Text>已收录 {total} 只猫猫</Text><View className='cat-list-v2__toolbar-actions'><View className='cat-list-v2__sort'><Text onClick={() => setSortOpen((value) => !value)}>{sort}</Text>{sortOpen && <View className='cat-list-v2__sort-menu'>{sortOptions.map((item) => <Text key={item} className={sort === item ? 'is-current' : ''} onClick={() => changeSort(item)}>{item}</Text>)}</View>}</View><Text className='cat-list-v2__submit' onClick={() => void navigateToWithGuard('/pages/cat-atlas/report?mode=new')}>投稿新猫</Text></View></View>
      {loading && !items.length && <RequestState loading error={error} onRetry={() => void load()} />}
      {!loading && error && <RequestState error={error} onRetry={() => void load()} />}
      {!loading && !error && <RequestState empty={!items.length ? '还没有符合条件的猫咪' : undefined} />}
      {!loading && !error && <View className='cat-list-v2__items'>{items.map((cat, index) => {
        const isLiked = cat.favorited
        return <View className='cat-list-v2__card' style={{ animationDelay: `${Math.min(index, 6) * 70}ms` }} key={cat.id} onClick={() => void navigateToWithGuard(`/pages/cat-atlas/detail?id=${cat.id}`)}><View className='cat-list-v2__cover'><CatCover cat={cat} />{index === 0 && <Text className='cat-list-v2__rank'>TOP 1</Text>}</View><View className='cat-list-v2__body'><View className='cat-list-v2__title'><Text>{cat.name}</Text>{index === 0 && <Text>✦</Text>}</View><View className='cat-list-v2__tags'>{cat.traits.slice(0, 3).map((trait, traitIndex) => <Text className={tagClass(traitIndex)} key={trait}>{trait}</Text>)}</View><View className='cat-list-v2__meta'><View><Image src={locationIcon} mode='aspectFit' /><Text>{cat.resident_area}</Text></View><Text>{cat.sighting_count} 人遇见</Text></View></View><View className={`cat-list-v2__heart ${isLiked ? 'is-liked' : ''}`} ariaRole='button' ariaLabel={isLiked ? '取消收藏猫咪' : '收藏猫咪'} onClick={async (event) => { event.stopPropagation(); setItems((current) => current.map((item) => item.id === cat.id ? { ...item, favorited: !isLiked } : item)); try { await setCatFavorite(cat.id, !isLiked) } catch (favoriteError) { setItems((current) => current.map((item) => item.id === cat.id ? { ...item, favorited: isLiked } : item)); void Taro.showToast({ title: favoriteError instanceof Error ? favoriteError.message : '收藏失败', icon: 'none' }) } }}><Image src={heartIcon} mode='aspectFit' /></View></View>
      })}</View>}
      {!loading && !error && items.length > 0 && (hasMore ? <Text className={`cat-list-v2__load-more ${loadingMore ? 'is-loading' : ''}`} onClick={loadMore}>{loadingMore ? '正在加载更多…' : `上拉或点击加载更多（已显示 ${items.length}/${total}）`}</Text> : <Text className='cat-list-v2__end'>已加载全部 {total} 只在录猫咪 · 持续补充中</Text>)}
    </View>
    <View className='cat-list-v2__fab' ariaRole='button' ariaLabel='投稿新猫' onClick={() => void navigateToWithGuard('/pages/cat-atlas/report?mode=new')}><Image src={plusIcon} mode='aspectFit' /><Text>投稿猫咪</Text></View>
  </View>
}
