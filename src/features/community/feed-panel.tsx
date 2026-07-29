import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import type { CampusCirclePostView, CampusCircleSectionView } from '../../api/types'
import { isApiError } from '../../api/client'
import { KeyboardSafeInput } from '../../components/keyboard-safe-input'
import { lifeServicesRepository } from '../life-services/repository'
import CommunityPostCard from './post-card'
import './feed-panel.scss'

type Props = {
  sectionRoots: CampusCircleSectionView[]
  activeSection: CampusCircleSectionView | null
  sectionsReady: boolean
  sectionsError?: string
  onRetrySections?: () => void
  refreshSignal?: number
  searchFocusSignal?: number
  filterLabel?: string
  canFilter?: boolean
  onOpenFilter?: () => void
}

const flattenSections = (items: CampusCircleSectionView[]): CampusCircleSectionView[] => (
  items.flatMap((item) => [item, ...flattenSections(item.children || [])])
)

const mergeUniquePosts = (
  current: CampusCirclePostView[],
  incoming: CampusCirclePostView[],
) => {
  const byId = new Map(current.map((item) => [item.id, item]))
  incoming.forEach((item) => byId.set(item.id, item))
  return [...byId.values()]
}

export default function CommunityFeedPanel({
  sectionRoots,
  activeSection,
  sectionsReady,
  sectionsError = '',
  onRetrySections,
  refreshSignal = 0,
  searchFocusSignal = 0,
  filterLabel = '全部',
  canFilter = false,
  onOpenFilter,
}: Props) {
  const [draftKeyword, setDraftKeyword] = useState('')
  const [keyword, setKeyword] = useState('')
  const [posts, setPosts] = useState<CampusCirclePostView[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const requestSequence = useRef(0)

  const sections = useMemo(
    () => flattenSections(sectionRoots),
    [sectionRoots],
  )
  const sectionNames = useMemo(
    () => new Map(sections.map((item) => [item.id, item.name])),
    [sections],
  )
  const activeSectionId = activeSection?.id
  const activeParentSectionId = activeSection?.parent_id
  const load = useCallback(async (nextPage = 1, append = false) => {
    if (!activeSectionId) return
    const requestId = ++requestSequence.current
    append ? setLoadingMore(true) : setLoading(true)
    setError('')
    try {
      const isRoot = activeParentSectionId === null
      const result = await lifeServicesRepository.listCampusCirclePosts({
        sectionId: isRoot ? undefined : activeSectionId,
        parentSectionId: isRoot ? activeSectionId : undefined,
        keyword,
        page: nextPage,
      })
      if (requestId !== requestSequence.current) return
      setPosts((current) => append
        ? mergeUniquePosts(current, result.items)
        : result.items)
      setPage(result.page)
      setTotal(Number(result.total))
    } catch (loadError) {
      if (requestId !== requestSequence.current) return
      setError(isApiError(loadError)
        ? loadError.message
        : '没有连接到校园社区，请稍后重试')
    } finally {
      if (requestId === requestSequence.current) {
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }, [activeParentSectionId, activeSectionId, keyword])

  useEffect(() => {
    if (!sectionsReady || !activeSectionId) return
    void load(1, false)
  }, [activeSectionId, load, refreshSignal, sectionsReady])

  useEffect(() => {
    if (searchFocusSignal > 0) setSearchFocused(true)
  }, [searchFocusSignal])

  const toggleLike = async (post: CampusCirclePostView) => {
    try {
      const updated = post.liked
        ? await lifeServicesRepository.unlikeCampusCirclePost(post.id)
        : await lifeServicesRepository.likeCampusCirclePost(post.id)
      setPosts((current) => current.map((item) => item.id === post.id ? updated : item))
    } catch (toggleError) {
      Taro.showToast({
        title: isApiError(toggleError) ? toggleError.message : '操作失败',
        icon: 'none',
      })
    }
  }

  const openPost = (post: CampusCirclePostView) => {
    Taro.navigateTo({ url: `/pages/community/detail?id=${post.id}&mode=post` })
  }

  const canLoadMore = posts.length < total

  return (
    <View className='api-community'>
      <View className='api-community-search'>
        <View className='api-community-search__icon' />
        <KeyboardSafeInput
          id='community-search-input'
          value={draftKeyword}
          focus={searchFocused}
          maxlength={40}
          confirmType='search'
          placeholder='搜索动态、话题或校园关键词'
          placeholderClass='api-community-search__placeholder'
          onInput={(event) => setDraftKeyword(event.detail.value)}
          onConfirm={() => setKeyword(draftKeyword.trim())}
          onBlur={() => setSearchFocused(false)}
        />
        {draftKeyword && (
          <View
            onClick={() => {
              setDraftKeyword('')
              setKeyword('')
            }}
          >
            清除
          </View>
        )}
        <View
          id='community-search-submit'
          onClick={() => setKeyword(draftKeyword.trim())}
        >
          搜索
        </View>
      </View>

      <View className='api-community__heading'>
        <View>
          <Text>{keyword ? `“${keyword}”` : '最新动态'}</Text>
          <Text>{keyword ? '搜索结果' : '按发布时间排列'}</Text>
        </View>
        <View className='api-community__heading-actions'>
          <Text>{loading ? '加载中' : `${total} 条动态`}</Text>
          {canFilter && (
            <View
              className='api-community__filter'
              hoverClass='api-community__filter--pressed'
              onClick={onOpenFilter}
            >
              <Text>{filterLabel}</Text>
              <Text>筛选</Text>
            </View>
          )}
        </View>
      </View>

      {!sectionsReady && <View className='api-community-state'>正在加载社区板块</View>}
      {sectionsReady && sectionsError && (
        <View className='api-community-state api-community-state--error'>
          <Text>{sectionsError}</Text>
          <View onClick={onRetrySections}>重新加载板块</View>
        </View>
      )}
      {sectionsReady && !sectionsError && !activeSection && (
        <View className='api-community-state api-community-state--empty'>
          <View>OUC</View>
          <Text>暂无启用的社区板块</Text>
          <Text>请联系管理员在服务端配置板块</Text>
        </View>
      )}
      {sectionsReady && !sectionsError && activeSection && loading && (
        <View className='community-feed-skeleton'>
          {[0, 1].map((index) => (
            <View key={index} className='community-feed-skeleton__item'>
              <View className='community-feed-skeleton__header'>
                <View />
                <View><View /><View /></View>
              </View>
              <View className='community-feed-skeleton__line' />
              <View className='community-feed-skeleton__line community-feed-skeleton__line--short' />
              <View className='community-feed-skeleton__media' />
            </View>
          ))}
        </View>
      )}
      {sectionsReady && !sectionsError && activeSection && !loading && error && (
        <View className='api-community-state api-community-state--error'>
          <Text>{error}</Text>
          <View onClick={() => void load(1, false)}>重新加载</View>
        </View>
      )}

      {sectionsReady && !sectionsError && activeSection && !loading && !error && (
        <View className='community-post-list'>
          {posts.map((post) => (
            <CommunityPostCard
              key={post.id}
              post={post}
              sectionName={sectionNames.get(post.section_id) || '未知板块'}
              onToggleLike={(target) => void toggleLike(target)}
              onOpen={openPost}
            />
          ))}
        </View>
      )}

      {sectionsReady && !sectionsError && activeSection && !loading && !error && posts.length === 0 && (
        <View className='api-community-state api-community-state--empty'>
          <View>OUC</View>
          <Text>{keyword ? '没有找到相关动态' : '这个板块还没有动态'}</Text>
          <Text>{keyword ? '换个关键词试试吧' : '去统一发布器分享第一条内容'}</Text>
        </View>
      )}

      {sectionsReady && !sectionsError && activeSection && !loading && !error && canLoadMore && (
        <View
          className='api-community-load-more'
          id='community-load-more'
          onClick={() => !loadingMore && void load(page + 1, true)}
        >
          {loadingMore ? '正在加载' : '查看更多'}
        </View>
      )}
    </View>
  )
}
