import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import type { CampusCirclePostView, CampusCircleSectionView } from '../../api/types'
import { isApiError } from '../../api/client'
import { requestWechatSubscriptionForModule } from '../wechat-subscription'
import { KeyboardSafeInput } from '../../components/keyboard-safe-input'
import { lifeServicesRepository } from '../life-services/repository'
import {
  getLifeHubRefreshRevision,
  isLifeHubCacheReusable,
  markLifeHubSectionDirty,
  markLifeHubSectionFresh,
} from '../life-services/refresh-policy'
import { openPublicProfile } from '../profile/public-profile'
import CommunityCommentSheet from './comment-sheet'
import { mergePublicCommentPreview } from './comments'
import { saveCommunityDetailSnapshot } from './detail-snapshot'
import CommunityPostCard, { type CommunityPostCommentPreview } from './post-card'
import './feed-panel.scss'

type Props = {
  sectionRoots: CampusCircleSectionView[]
  activeSection: CampusCircleSectionView | null
  sectionsReady: boolean
  sectionsError?: string
  onRetrySections?: () => void
  pinnedPost?: CampusCirclePostView | null
  refreshSignal?: number
  searchFocusSignal?: number
  overlayDismissSignal?: number
  onOverlayVisibilityChange?: (visible: boolean) => void
  onSelectSection?: (sectionId: number) => void
}

type CommunityFeedCacheEntry = {
  posts: CampusCirclePostView[]
  page: number
  total: number
  refreshedAt: number
  revision: number
}

const communityFeedCache = new Map<string, CommunityFeedCacheEntry>()
const COMMUNITY_FEED_CACHE_LIMIT = 20

const saveCommunityFeedCache = (key: string, entry: CommunityFeedCacheEntry) => {
  communityFeedCache.delete(key)
  communityFeedCache.set(key, entry)
  if (communityFeedCache.size <= COMMUNITY_FEED_CACHE_LIMIT) return
  const oldestKey = communityFeedCache.keys().next().value
  if (oldestKey) communityFeedCache.delete(oldestKey)
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
  pinnedPost = null,
  refreshSignal = 0,
  searchFocusSignal = 0,
  overlayDismissSignal = 0,
  onOverlayVisibilityChange,
  onSelectSection,
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
  const [commentPost, setCommentPost] = useState<CampusCirclePostView | null>(null)
  const [commentReplyTarget, setCommentReplyTarget] = useState<CommunityPostCommentPreview | null>(null)
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [commentDismissSignal, setCommentDismissSignal] = useState(0)
  const [openActionPostId, setOpenActionPostId] = useState<number | null>(null)
  const requestSequence = useRef(0)
  const pendingPinnedPost = useRef<CampusCirclePostView | null>(null)
  const lastOverlayDismissSignalRef = useRef(overlayDismissSignal)

  useEffect(() => {
    pendingPinnedPost.current = pinnedPost
  }, [pinnedPost])

  useEffect(() => {
    onOverlayVisibilityChange?.(
      openActionPostId !== null || (commentPost !== null && !commentSubmitting),
    )
  }, [commentPost, commentSubmitting, onOverlayVisibilityChange, openActionPostId])

  useEffect(() => () => {
    onOverlayVisibilityChange?.(false)
  }, [onOverlayVisibilityChange])

  useEffect(() => {
    if (overlayDismissSignal === lastOverlayDismissSignalRef.current) return
    lastOverlayDismissSignalRef.current = overlayDismissSignal
    setOpenActionPostId(null)
    if (commentPost) setCommentDismissSignal((current) => current + 1)
  }, [commentPost, overlayDismissSignal])

  const sections = useMemo(
    () => flattenSections(sectionRoots),
    [sectionRoots],
  )
  const sectionNames = useMemo(
    () => new Map(sections.map((item) => [item.id, item.name])),
    [sections],
  )
  const activeSectionId = activeSection?.id
  const sectionNameForPost = (post: CampusCirclePostView, fallback: string) => (
    sectionNames.get(post.section_id) || fallback
  )
  const activeParentSectionId = activeSection?.parent_id
  const queryKey = useMemo(() => JSON.stringify({
    activeSectionId,
    activeParentSectionId,
    keyword,
  }), [activeParentSectionId, activeSectionId, keyword])
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
      const pinned = !append && nextPage === 1
        ? pendingPinnedPost.current
        : null
      const incoming = pinned
        ? [pinned, ...result.items.filter((item) => item.id !== pinned.id)]
        : result.items
      const refreshedAt = Date.now()
      const revision = getLifeHubRefreshRevision('community')
      setPosts((current) => {
        const nextPosts = append
          ? mergeUniquePosts(current, incoming)
          : incoming
        saveCommunityFeedCache(queryKey, {
          posts: nextPosts,
          page: result.page,
          total: Number(result.total),
          refreshedAt,
          revision,
        })
        return nextPosts
      })
      if (pinned) pendingPinnedPost.current = null
      setPage(result.page)
      setTotal(Number(result.total))
      markLifeHubSectionFresh('community', refreshedAt)
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
  }, [activeParentSectionId, activeSectionId, keyword, queryKey])

  useEffect(() => {
    if (!sectionsReady || !activeSectionId) return
    const cached = communityFeedCache.get(queryKey)
    if (
      cached
      && isLifeHubCacheReusable(
        'community',
        cached.revision,
        cached.refreshedAt,
      )
    ) {
      const pinned = pendingPinnedPost.current
      setPosts(pinned
        ? [pinned, ...cached.posts.filter((item) => item.id !== pinned.id)]
        : cached.posts)
      pendingPinnedPost.current = null
      setPage(cached.page)
      setTotal(cached.total)
      setError('')
      setLoading(false)
      markLifeHubSectionFresh('community', cached.refreshedAt)
      return
    }
    void load(1, false)
  }, [activeSectionId, load, queryKey, refreshSignal, sectionsReady])

  useEffect(() => {
    if (searchFocusSignal > 0) setSearchFocused(true)
  }, [searchFocusSignal])

  const toggleLike = useCallback(async (post: CampusCirclePostView) => {
    try {
      const updated = post.liked
        ? await lifeServicesRepository.unlikeCampusCirclePost(post.id)
        : await lifeServicesRepository.likeCampusCirclePost(post.id)
      setPosts((current) => current.map((item) => item.id === post.id ? updated : item))
      markLifeHubSectionDirty('community')
    } catch (toggleError) {
      Taro.showToast({
        title: isApiError(toggleError) ? toggleError.message : '操作失败',
        icon: 'none',
      })
    }
  }, [])

  const openPost = useCallback((post: CampusCirclePostView) => {
    setOpenActionPostId(null)
    requestWechatSubscriptionForModule('community')
    saveCommunityDetailSnapshot(post)
    Taro.navigateTo({ url: `/packages/social/community/detail?id=${post.id}&mode=post&snapshot=1` })
  }, [])

  const openComments = useCallback((post: CampusCirclePostView) => {
    setOpenActionPostId(null)
    setCommentSubmitting(false)
    setCommentReplyTarget(null)
    setCommentPost(post)
  }, [])

  const openCommentReply = useCallback((
    post: CampusCirclePostView,
    comment: CommunityPostCommentPreview,
  ) => {
    setOpenActionPostId(null)
    setCommentSubmitting(false)
    setCommentReplyTarget(comment)
    setCommentPost(post)
  }, [])

  const toggleActions = useCallback((postId: number) => {
    setOpenActionPostId((current) => current === postId ? null : postId)
  }, [])

  const closeActions = useCallback(() => {
    setOpenActionPostId(null)
  }, [])

  const updateLatestComment = useCallback((comment: Parameters<typeof mergePublicCommentPreview>[1]) => {
    setPosts((current) => current.map((item) => (
      item.id === comment.target_id
        ? {
            ...item,
            comment_previews: mergePublicCommentPreview(
              item.comment_previews,
              comment,
              commentReplyTarget,
            ),
          }
        : item
    )))
  }, [commentReplyTarget])

  const updateCommentCount = useCallback((postId: number, delta: number) => {
    setPosts((current) => current.map((item) => (
      item.id === postId
        ? { ...item, comment_count: Math.max(0, item.comment_count + delta) }
        : item
    )))
  }, [])

  const openAuthor = useCallback((post: CampusCirclePostView) => {
    void openPublicProfile(post.author_id)
  }, [])

  const canLoadMore = posts.length < total
  const normalizedDraftKeyword = draftKeyword.trim()

  const hideSearchKeyboard = () => {
    setSearchFocused(false)
    void Taro.hideKeyboard().catch(() => undefined)
  }

  const submitSearch = () => {
    if (!normalizedDraftKeyword) {
      setDraftKeyword('')
      if (keyword) setKeyword('')
      hideSearchKeyboard()
      return
    }

    setDraftKeyword(normalizedDraftKeyword)
    hideSearchKeyboard()
    if (normalizedDraftKeyword === keyword) {
      void load(1, false)
      return
    }
    setKeyword(normalizedDraftKeyword)
  }

  const clearSearch = (keepFocus = false) => {
    setDraftKeyword('')
    if (keyword) setKeyword('')
    if (keepFocus) {
      setSearchFocused(true)
      return
    }
    hideSearchKeyboard()
  }

  const cancelSearchEdit = () => {
    setDraftKeyword(keyword)
    hideSearchKeyboard()
  }

  return (
    <View className='api-community'>
      <View
        className={[
          'api-community-search',
          searchFocused ? 'api-community-search--focused' : '',
          keyword ? 'api-community-search--active' : '',
        ].filter(Boolean).join(' ')}
      >
        <View className='api-community-search__icon' />
        <KeyboardSafeInput
          id='community-search-input'
          value={draftKeyword}
          focus={searchFocused}
          keepVisibleOnKeyboard={false}
          maxlength={40}
          confirmType='search'
          placeholder='搜索动态、话题或校园关键词'
          placeholderClass='api-community-search__placeholder'
          onInput={(event) => setDraftKeyword(event.detail.value)}
          onConfirm={submitSearch}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        />
        {draftKeyword && (
          <View
            className='api-community-search__clear'
            ariaLabel='清除搜索内容'
            onClick={() => clearSearch(true)}
          >
            ×
          </View>
        )}
        {(searchFocused || draftKeyword || keyword) && (
          <View
            id='community-search-submit'
            className={[
              'api-community-search__submit',
              normalizedDraftKeyword
                ? ''
                : 'api-community-search__submit--secondary',
            ].filter(Boolean).join(' ')}
            onClick={normalizedDraftKeyword
              ? submitSearch
              : keyword
                ? () => clearSearch(false)
                : cancelSearchEdit}
          >
            {normalizedDraftKeyword ? '搜索' : keyword ? '清除' : '取消'}
          </View>
        )}
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
          {posts.map((post, index) => (
            <CommunityPostCard
              key={post.id}
              post={post}
              motionDelay={index < 4 ? index + 1 : undefined}
              sectionName={sectionNameForPost(post, '未知板块')}
              actionsOpen={openActionPostId === post.id}
              onToggleActions={toggleActions}
              onCloseActions={closeActions}
              onToggleLike={toggleLike}
              onOpen={openPost}
              onOpenComments={openComments}
              onReplyComment={openCommentReply}
              onOpenAuthor={openAuthor}
              onSelectSection={onSelectSection}
            />
          ))}
        </View>
      )}

      {sectionsReady && !sectionsError && activeSection && !loading && !error && posts.length === 0 && (
        <View className='api-community-state api-community-state--empty'>
          <View>OUC</View>
          <Text>{keyword ? '没有找到相关动态' : '这个板块还没有动态'}</Text>
          <Text>{keyword ? '换个关键词试试吧' : '去统一发布器分享第一条内容'}</Text>
          {keyword && (
            <View
              onClick={() => clearSearch(false)}
            >
              清除搜索
            </View>
          )}
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
      {commentPost && (
        <CommunityCommentSheet
          key={commentPost.id}
          post={commentPost}
          initialReplyTarget={commentReplyTarget ? {
            id: commentReplyTarget.id,
            author_id: commentReplyTarget.authorId,
            author_deleted: commentReplyTarget.authorDeleted,
            author_nickname: commentReplyTarget.authorNickname,
            root_id: commentReplyTarget.rootId,
          } : null}
          onClose={() => {
            setCommentPost(null)
            setCommentReplyTarget(null)
            setCommentSubmitting(false)
          }}
          onSubmittingChange={setCommentSubmitting}
          dismissSignal={commentDismissSignal}
          onApprovedDelta={(delta) => updateCommentCount(commentPost.id, delta)}
          onCommentCreated={updateLatestComment}
        />
      )}
    </View>
  )
}
