import { useEffect, useRef, useState } from 'react'
import Taro, { usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { Image, ScrollView, Text, View } from '@tarojs/components'
import type { ITouchEvent } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import { KeyboardSafeInput } from '../../components/keyboard-safe-input'
import { isApiError } from '../../api/client'
import { ensureClubEditorAccess } from '../../features/clubs/access'
import { clubsRepository } from '../../features/clubs/repository'
import type {
  ClubCategory,
  ClubDirectoryBucket,
  ClubDirectoryIndex,
  ClubDirectoryItem,
  ClubSummary,
} from '../../features/clubs/types'
import { useCampusShare } from '../../features/share'
import './index.scss'

const PAGE_SIZE = 12
const DIRECTORY_PAGE_SIZE = 20
type ClubViewMode = 'card' | 'directory'

type DirectoryBucketState = {
  items: ClubDirectoryItem[]
  nextCursor: string | null
  loading: boolean
  error: string
}

const directorySectionId = (initial: string) => (
  initial === '#' ? 'club-directory-section-other' : `club-directory-section-${initial}`
)

const mergeClubs = <T extends { id: number }>(current: T[], incoming: T[]) => {
  const seen = new Set(current.map((club) => club.id))
  return current.concat(incoming.filter((club) => {
    if (seen.has(club.id)) return false
    seen.add(club.id)
    return true
  }))
}

export default function ClubsPage() {
  useCampusShare(() => ({
    title: '海大社团广场｜发现喜欢的校园社团',
    path: '/pages/clubs/index',
  }))

  const [categories, setCategories] = useState<ClubCategory[]>([])
  const [clubs, setClubs] = useState<ClubSummary[]>([])
  const [query, setQuery] = useState('')
  const [keyword, setKeyword] = useState('')
  const [categoryId, setCategoryId] = useState(0)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState<ClubViewMode>('card')
  const [directory, setDirectory] = useState<ClubDirectoryIndex | null>(null)
  const [directoryBuckets, setDirectoryBuckets] = useState<Record<string, DirectoryBucketState>>({})
  const [directoryLoading, setDirectoryLoading] = useState(false)
  const [directoryError, setDirectoryError] = useState('')
  const [directoryQueryKey, setDirectoryQueryKey] = useState('')
  const [activeInitial, setActiveInitial] = useState('')
  const [indexPrompt, setIndexPrompt] = useState('')
  const requestVersion = useRef(0)
  const directoryRequestVersion = useRef(0)
  const directoryPageRequestSequence = useRef(0)
  const directoryBucketRequestVersions = useRef<Record<string, number>>({})
  const indexRailBounds = useRef<{ top: number; height: number } | null>(null)
  const indexPromptTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = async (reset = true, nextKeyword = keyword, nextCategory = categoryId) => {
    if (!reset && (loadingMore || clubs.length >= total)) return
    const targetPage = reset ? 1 : page + 1
    const version = reset ? requestVersion.current + 1 : requestVersion.current
    if (reset) {
      requestVersion.current = version
      setLoading(true)
      setError('')
    } else {
      setLoadingMore(true)
    }
    try {
      const result = await clubsRepository.listPublic({
        keyword: nextKeyword,
        categoryId: nextCategory || undefined,
        page: targetPage,
        pageSize: PAGE_SIZE,
      })
      if (version !== requestVersion.current) return
      setClubs((current) => reset ? result.items : mergeClubs(current, result.items))
      setPage(result.page)
      setTotal(result.total)
    } catch (loadError) {
      if (version === requestVersion.current) {
        setError(isApiError(loadError) ? loadError.message : '社团目录加载失败，请稍后重试')
      }
    } finally {
      if (version === requestVersion.current) {
        setLoading(false)
        setLoadingMore(false)
      }
      Taro.stopPullDownRefresh()
    }
  }

  const loadDirectoryBucket = async (
    initial: string,
    index: ClubDirectoryIndex,
    nextCategory = categoryId,
    reset = true,
  ) => {
    const previous = directoryBuckets[initial]
    if (!reset && (!previous || !previous.nextCursor || previous.loading)) return
    const requestKey = `${nextCategory}:${initial}`
    const version = directoryPageRequestSequence.current + 1
    directoryPageRequestSequence.current = version
    directoryBucketRequestVersions.current[requestKey] = version
    setDirectoryBuckets((current) => ({
      ...current,
      [initial]: {
        items: reset ? [] : (current[initial]?.items || []),
        nextCursor: reset ? null : (current[initial]?.nextCursor || null),
        loading: true,
        error: '',
      },
    }))
    try {
      const result = await clubsRepository.listDirectoryPage({
        initial,
        cursor: reset ? undefined : previous?.nextCursor || undefined,
        pageSize: DIRECTORY_PAGE_SIZE,
        categoryId: nextCategory || undefined,
      })
      if (directoryBucketRequestVersions.current[requestKey] !== version) return
      if (result.version !== index.version) {
        void loadDirectory(nextCategory)
        return
      }
      setDirectoryBuckets((current) => ({
        ...current,
        [initial]: {
          items: reset ? result.items : mergeClubs(current[initial]?.items || [], result.items),
          nextCursor: result.next_cursor,
          loading: false,
          error: '',
        },
      }))
    } catch (loadError) {
      if (directoryBucketRequestVersions.current[requestKey] !== version) return
      if (isApiError(loadError) && loadError.code === 'club_directory_version_changed') {
        void loadDirectory(nextCategory)
        return
      }
      setDirectoryBuckets((current) => ({
        ...current,
        [initial]: {
          items: reset ? [] : (current[initial]?.items || []),
          nextCursor: reset ? null : (current[initial]?.nextCursor || null),
          loading: false,
          error: isApiError(loadError) ? loadError.message : '社团索引加载失败，请稍后重试',
        },
      }))
    }
  }

  const loadDirectory = async (nextCategory = categoryId) => {
    const version = directoryRequestVersion.current + 1
    const queryKey = String(nextCategory)
    directoryRequestVersion.current = version
    setDirectoryLoading(true)
    setDirectoryError('')
    try {
      const result = await clubsRepository.getDirectoryIndex({
        categoryId: nextCategory || undefined,
      })
      if (version !== directoryRequestVersion.current) return
      setDirectory(result)
      directoryBucketRequestVersions.current = {}
      setDirectoryBuckets({})
      setDirectoryQueryKey(queryKey)
      const firstInitial = result.buckets[0]?.initial || ''
      setActiveInitial(firstInitial)
      if (firstInitial) void loadDirectoryBucket(firstInitial, result, nextCategory)
    } catch (loadError) {
      if (version === directoryRequestVersion.current) {
        setDirectoryError(isApiError(loadError) ? loadError.message : '社团索引加载失败，请稍后重试')
      }
    } finally {
      if (version === directoryRequestVersion.current) setDirectoryLoading(false)
      Taro.stopPullDownRefresh()
    }
  }

  useEffect(() => {
    void clubsRepository.listCategories()
      .then(setCategories)
      .catch(() => undefined)
    void load(true)
    // 首次进入只触发一次，后续筛选由用户操作显式请求。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => () => {
    if (indexPromptTimer.current) clearTimeout(indexPromptTimer.current)
  }, [])

  usePullDownRefresh(() => {
    void Promise.all([
      clubsRepository.listCategories().then(setCategories),
      viewMode === 'directory' ? loadDirectory(categoryId) : load(true),
    ]).catch(() => undefined).finally(() => Taro.stopPullDownRefresh())
  })

  useReachBottom(() => {
    if (viewMode === 'card') void load(false)
    else if (directory && activeInitial) {
      void loadDirectoryBucket(activeInitial, directory, categoryId, false)
    }
  })

  const search = () => {
    const nextKeyword = query.trim()
    setKeyword(nextKeyword)
    if (viewMode === 'directory' && nextKeyword) {
      setViewMode('card')
    }
    void load(true, nextKeyword, categoryId)
  }

  const chooseCategory = (nextCategoryId: number) => {
    const nextKeyword = query.trim()
    setKeyword(nextKeyword)
    setCategoryId(nextCategoryId)
    if (viewMode === 'directory') void loadDirectory(nextCategoryId)
    else void load(true, nextKeyword, nextCategoryId)
  }

  const clearFilters = () => {
    setQuery('')
    setKeyword('')
    setCategoryId(0)
    if (viewMode === 'directory') void loadDirectory(0)
    else void load(true, '', 0)
  }

  const chooseViewMode = (nextMode: ClubViewMode) => {
    if (nextMode === viewMode) return
    setViewMode(nextMode)
    if (nextMode === 'directory') {
      const queryKey = String(categoryId)
      if (!directory || directoryQueryKey !== queryKey) void loadDirectory(categoryId)
    } else {
      // 目录视图可能已经修改过筛选条件，切回卡片时同步刷新，避免展示旧结果。
      void load(true, keyword, categoryId)
    }
  }

  const jumpToInitial = (initial: string) => {
    if (!initial) return
    setActiveInitial(initial)
    setIndexPrompt(initial)
    if (indexPromptTimer.current) clearTimeout(indexPromptTimer.current)
    indexPromptTimer.current = setTimeout(() => setIndexPrompt(''), 520)
    const bucket = directoryBuckets[initial]
    if (directory && (!bucket || (!bucket.loading && bucket.items.length === 0))) {
      void loadDirectoryBucket(initial, directory, categoryId)
    }
    void Taro.pageScrollTo({
      selector: `#${directorySectionId(initial)}`,
      offsetTop: -12,
      duration: 160,
    })
  }

  const jumpFromClientY = (clientY: number) => {
    const initials = directory?.buckets.map((bucket) => bucket.initial) || []
    const bounds = indexRailBounds.current
    if (!initials.length || !bounds?.height) return
    const ratio = Math.max(0, Math.min(0.999, (clientY - bounds.top) / bounds.height))
    jumpToInitial(initials[Math.floor(ratio * initials.length)])
  }

  const jumpFromIndexTouch = (event: ITouchEvent) => {
    const touch = event.touches[0] || event.changedTouches[0]
    if (touch) jumpFromClientY(touch.clientY)
  }

  const handleIndexTouchStart = (event: ITouchEvent) => {
    const touch = event.touches[0] || event.changedTouches[0]
    if (!touch) return
    const clientY = touch.clientY
    Taro.createSelectorQuery()
      .select('#club-directory-index')
      .boundingClientRect((rect) => {
        if (rect && !Array.isArray(rect)) {
          indexRailBounds.current = { top: rect.top, height: rect.height }
        }
        jumpFromClientY(clientY)
      })
      .exec()
  }

  const createClub = async () => {
    if (!await ensureClubEditorAccess()) return
    await Taro.navigateTo({ url: '/pages/clubs/edit' })
  }

  return (
    <View className='clubs-page'>
      <CustomNavbar title='社团广场' subtitle='遇见志同道合的人' showBack />
      <View className='clubs-hero'>
        <View className='clubs-hero__copy'>
          <Text className='clubs-hero__title'>在山海之间，找到你的热爱</Text>
          <Text className='clubs-hero__subtitle'>浏览校园社团的故事、文化与精彩瞬间</Text>
        </View>
        <View className='clubs-hero__mark'>
          <Image src={require('../../assets/icons/clubs-white.svg')} mode='aspectFit' />
        </View>
      </View>

      <View className='clubs-toolbar'>
        <View className='clubs-search'>
          <Image src={require('../../assets/icons/search.svg')} mode='aspectFit' />
          <KeyboardSafeInput
            id='club-search'
            value={query}
            placeholder={viewMode === 'directory' ? '搜索社团名称或简称' : '搜索社团名称或介绍'}
            confirmType='search'
            ariaLabel='搜索社团'
            onInput={(event) => setQuery(event.detail.value)}
            onConfirm={search}
          />
          {!!query && (
            <View
              className='clubs-search__clear'
              ariaRole='button'
              ariaLabel='清空搜索内容'
              hoverClass='clubs-search__clear--pressed'
              onClick={() => {
                setQuery('')
                setKeyword('')
                if (viewMode === 'directory') void loadDirectory(categoryId)
                else void load(true, '', categoryId)
              }}
            >×</View>
          )}
          <View id='club-search-action' className='clubs-search__action' ariaRole='button' onClick={search}>搜索</View>
        </View>
        <ScrollView className='clubs-categories' scrollX enhanced showScrollbar={false}>
          <View className='clubs-categories__row'>
            <View
              className={`clubs-category ${categoryId === 0 ? 'clubs-category--active' : ''}`}
              ariaRole='button'
              ariaLabel={categoryId === 0 ? '全部分类，已选中' : '选择全部分类'}
              onClick={() => chooseCategory(0)}
            >全部</View>
            {categories.filter((category) => category.status === 'active').map((category) => (
              <View
                key={category.id}
                className={`clubs-category ${categoryId === category.id ? 'clubs-category--active' : ''}`}
                ariaRole='button'
                ariaLabel={`${category.name}${categoryId === category.id ? '，已选中' : ''}`}
                onClick={() => chooseCategory(category.id)}
              >{category.name}</View>
            ))}
          </View>
        </ScrollView>
      </View>

      <View className='clubs-workspace'>
        <View
          className='clubs-workspace__mine'
          ariaRole='button'
          ariaLabel='查看我的社团资料和审核进度'
          hoverClass='clubs-workspace__mine--pressed'
          onClick={() => Taro.navigateTo({ url: '/pages/clubs/mine' })}
        >
          <Text>我的社团资料</Text>
          <Text>审核进度 ›</Text>
        </View>
        <View
          className='clubs-workspace__create'
          ariaRole='button'
          ariaLabel='创建社团主页'
          hoverClass='clubs-workspace__create--pressed'
          onClick={() => void createClub()}
        ><Text>＋</Text> 创建主页</View>
      </View>

      <View id='clubs-results' className='clubs-viewbar'>
        <View className='clubs-viewbar__title'>
          <Text>{viewMode === 'card' ? '已发布社团' : '社团索引'}</Text>
          <Text>{viewMode === 'card'
            ? (loading ? '正在加载' : `共 ${total} 个`)
            : (directoryLoading ? '正在加载' : `共 ${directory?.total || 0} 个`)}</Text>
        </View>
        <View className='clubs-viewbar__modes' ariaRole='tablist'>
          <View
            id='club-view-card'
            className={viewMode === 'card' ? 'clubs-viewbar__mode clubs-viewbar__mode--active' : 'clubs-viewbar__mode'}
            ariaRole='tab'
            ariaLabel={`卡片视图${viewMode === 'card' ? '，已选中' : ''}`}
            onClick={() => chooseViewMode('card')}
          >卡片</View>
          <View
            id='club-view-directory'
            className={viewMode === 'directory' ? 'clubs-viewbar__mode clubs-viewbar__mode--active' : 'clubs-viewbar__mode'}
            ariaRole='tab'
            ariaLabel={`目录视图${viewMode === 'directory' ? '，已选中' : ''}`}
            onClick={() => chooseViewMode('directory')}
          >目录</View>
        </View>
      </View>

      {viewMode === 'card' && <View className='clubs-list'>
        {loading && Array.from({ length: 4 }, (_, index) => (
          <View key={index} className='club-card club-card--skeleton'>
            <View className='club-card__visual'>
              <View className='club-card__cover skeleton-block' />
              <View className='skeleton-line skeleton-line--category' />
            </View>
            <View className='club-card__body'>
              <View className='skeleton-line skeleton-line--title' />
              <View className='skeleton-line' />
              <View className='skeleton-line skeleton-line--short' />
            </View>
          </View>
        ))}

        {!loading && error && clubs.length === 0 && (
          <View className='clubs-state clubs-state--error'>
            <Text className='clubs-state__title'>暂时没能打开社团广场</Text>
            <Text className='clubs-state__text'>{error}</Text>
            <View className='clubs-state__action' onClick={() => void load(true)}>重新加载</View>
          </View>
        )}

        {!loading && !error && clubs.length === 0 && (
          <View className='clubs-state'>
            <View className='clubs-state__icon'><Image src={require('../../assets/icons/clubs.svg')} mode='aspectFit' /></View>
            <Text className='clubs-state__title'>{keyword || categoryId ? '没有找到匹配的社团' : '社团主页正在准备中'}</Text>
            <Text className='clubs-state__text'>{keyword || categoryId ? '换个关键词或分类试试看' : '首批社团审核发布后会在这里出现'}</Text>
            {keyword || categoryId
              ? <View className='clubs-state__action' onClick={clearFilters}>清除筛选</View>
              : <View className='clubs-state__action' onClick={() => void createClub()}>创建社团主页</View>}
          </View>
        )}

        {!loading && !!error && clubs.length > 0 && (
          <View className='clubs-inline-error'>刷新失败，当前仍展示上次结果</View>
        )}

        {!loading && clubs.map((club) => (
          <View
            key={club.id}
            id={`club-card-${club.id}`}
            className='club-card'
            hoverClass='club-card--pressed'
            ariaRole='button'
            ariaLabel={`查看${club.name}`}
            onClick={() => Taro.navigateTo({ url: `/pages/clubs/detail?id=${club.id}` })}
          >
            <View className='club-card__visual'>
              <View className='club-card__cover'>
                {club.cover?.url
                  ? <Image src={club.cover.url} mode='aspectFill' lazyLoad ariaLabel={`${club.name}封面`} />
                  : <View className='club-card__placeholder'><Image src={require('../../assets/icons/clubs.svg')} mode='aspectFit' ariaLabel='社团默认封面' /></View>}
              </View>
              <View className='club-card__visual-meta'>
                <View className='club-card__logo'>
                  {club.logo?.url
                    ? <Image src={club.logo.url} mode='aspectFill' lazyLoad ariaLabel={`${club.name} Logo`} />
                    : <Image src={require('../../assets/icons/clubs.svg')} mode='aspectFit' ariaLabel='社团默认图标' />}
                </View>
                <Text className='club-card__category'>{club.category.name}</Text>
              </View>
            </View>
            <View className='club-card__body'>
              <Text className='club-card__name'>{club.name}</Text>
              {!!club.slogan && <Text className='club-card__slogan'>{club.slogan}</Text>}
              <Text className='club-card__summary'>{club.summary}</Text>
              <Text className='club-card__arrow'>›</Text>
            </View>
          </View>
        ))}

        {!loading && !error && loadingMore && <View className='clubs-list__footer'>正在加载更多社团</View>}
        {!loading && !error && clubs.length > 0 && clubs.length >= total && (
          <View className='clubs-list__footer'>已经看完全部 {total} 个社团</View>
        )}
      </View>}

      {viewMode === 'directory' && <View className='club-directory'>
        {directoryLoading && Array.from({ length: 5 }, (_, index) => (
          <View key={index} className='club-directory-skeleton'>
            <View className='club-directory-skeleton__logo skeleton-block' />
            <View><View className='skeleton-line skeleton-line--title' /><View className='skeleton-line skeleton-line--short' /></View>
          </View>
        ))}

        {!directoryLoading && !!directoryError && (
          <View className='clubs-state clubs-state--error'>
            <Text className='clubs-state__title'>社团索引加载失败</Text>
            <Text className='clubs-state__text'>{directoryError}</Text>
            <View className='clubs-state__action' onClick={() => void loadDirectory(categoryId)}>重新加载</View>
          </View>
        )}

        {!directoryLoading && !directoryError && !directory?.buckets.length && (
          <View className='clubs-state'>
            <View className='clubs-state__icon'><Image src={require('../../assets/icons/clubs.svg')} mode='aspectFit' /></View>
            <Text className='clubs-state__title'>{keyword || categoryId ? '目录中没有匹配的社团' : '社团主页正在准备中'}</Text>
            <Text className='clubs-state__text'>{keyword || categoryId ? '换个关键词或分类试试看' : '首批社团审核发布后会在这里出现'}</Text>
            {keyword || categoryId
              ? <View className='clubs-state__action' onClick={clearFilters}>清除筛选</View>
              : <View className='clubs-state__action' onClick={() => void createClub()}>创建社团主页</View>}
          </View>
        )}

        {!directoryLoading && !directoryError && !!directory?.buckets.length && (
          <View className='club-directory__layout'>
            <View className='club-directory__groups'>
              {directory.buckets.map((bucket: ClubDirectoryBucket) => {
                const bucketState = directoryBuckets[bucket.initial]
                const items = bucketState?.items || []
                return <View key={bucket.initial} id={directorySectionId(bucket.initial)} className='club-directory__section'>
                  <View className='club-directory__section-head'>
                    <Text>{bucket.initial}</Text>
                    <Text>{bucket.count} 个社团</Text>
                  </View>
                  <View className='club-directory__section-list'>
                    {items.map((club) => (
                      <View
                        key={club.id}
                        id={`club-directory-row-${club.id}`}
                        className='club-directory-row'
                        ariaRole='button'
                        ariaLabel={`查看${club.name}`}
                        hoverClass='club-directory-row--pressed'
                        onClick={() => Taro.navigateTo({ url: `/pages/clubs/detail?id=${club.id}` })}
                      >
                        <View className='club-directory-row__logo'>
                          {club.logo?.url
                            ? <Image src={club.logo.url} mode='aspectFill' lazyLoad ariaLabel={`${club.name} Logo`} />
                            : <Image src={require('../../assets/icons/clubs.svg')} mode='aspectFit' ariaLabel='社团默认图标' />}
                        </View>
                        <View className='club-directory-row__copy'>
                          <Text className='club-directory-row__name'>{club.name}</Text>
                          <Text className='club-directory-row__meta'>{club.short_name ? `${club.short_name} · ` : ''}{club.category.name}</Text>
                        </View>
                        <Text className='club-directory-row__arrow'>›</Text>
                      </View>
                    ))}
                    {!!bucketState?.loading && <View className='clubs-list__footer'>正在加载 {bucket.initial} 索引</View>}
                    {!bucketState?.loading && !!bucketState?.error && (
                      <View className='clubs-inline-error'>
                        {bucketState.error}
                        <Text onClick={() => void loadDirectoryBucket(bucket.initial, directory, categoryId)}>重新加载</Text>
                      </View>
                    )}
                    {!bucketState?.loading && !bucketState?.error && items.length === 0 && (
                      <View className='clubs-list__footer'>点击右侧 {bucket.initial} 加载此索引</View>
                    )}
                    {!bucketState?.loading && !bucketState?.error && items.length > 0 && !bucketState.nextCursor && (
                      <View className='clubs-list__footer'>{bucket.initial} 索引已全部加载</View>
                    )}
                  </View>
                </View>
              })}
            </View>
            <View
              id='club-directory-index'
              className='club-directory-index'
              ariaRole='navigation'
              ariaLabel='社团名称首字母索引'
              onTouchStart={handleIndexTouchStart}
              onTouchMove={jumpFromIndexTouch}
            >
              {directory.buckets.map((bucket) => (
                <View
                  key={bucket.initial}
                  id={`club-index-${bucket.initial === '#' ? 'other' : bucket.initial}`}
                  className={activeInitial === bucket.initial ? 'club-directory-index__item club-directory-index__item--active' : 'club-directory-index__item'}
                  onClick={() => jumpToInitial(bucket.initial)}
                >{bucket.initial}</View>
              ))}
            </View>
          </View>
        )}
        {!!indexPrompt && <View className='club-directory-prompt'>{indexPrompt}</View>}
      </View>}
    </View>
  )
}
