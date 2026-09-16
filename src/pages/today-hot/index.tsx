import { useCallback, useEffect, useRef, useState } from 'react'
import Taro, { useLoad, usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import type { CampusCirclePostView, CommentView } from '../../api/types'
import CustomNavbar from '../../components/custom-navbar'
import CommunityCommentSheet from '../../features/community/comment-sheet'
import { mergePublicCommentPreview } from '../../features/community/comments'
import { saveCommunityDetailSnapshot } from '../../features/community/detail-snapshot'
import CommunityPostCard from '../../features/community/post-card'
import { usePostExposure } from '../../features/community/use-post-exposure'
import { useViewPageVisible } from '../../features/community/use-view-page-visible'
import { lifeServicesRepository } from '../../features/life-services/repository'
import { openPublicProfile } from '../../features/profile/public-profile'
import { getTodayHotSessionWindow, reportTodayHotEvent } from '../../features/today-hot/analytics'
import { openTodayHotCommunity } from '../../features/today-hot/navigation'
import { todayHotRepository } from '../../features/today-hot/repository'
import { isApiError } from '../../api/client'
import './index.scss'

type Query = {
  snapshot_id?: string
  post_id?: string
  source?: string
}

function TodayHotEngagementProbe({
  postId,
  enabled,
  onQualified,
}: {
  postId: number
  enabled: boolean
  onQualified: (postId: number) => void
}) {
  usePostExposure({
    selector: `#today-hot-probe-${postId}`,
    enabled,
    onExposure: () => onQualified(postId),
  })
  return null
}

export default function TodayHotPage() {
  const [snapshotId, setSnapshotId] = useState<number | null>(null)
  const [contextPostId, setContextPostId] = useState<number | null>(null)
  const [source, setSource] = useState('today_hot_feed')
  const [posts, setPosts] = useState<CampusCirclePostView[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [contextUnavailable, setContextUnavailable] = useState(false)
  const [reloadSignal, setReloadSignal] = useState(0)
  const [commentPost, setCommentPost] = useState<CampusCirclePostView | null>(null)
  const [sectionNames, setSectionNames] = useState<Map<number, string>>(new Map())
  const qualifiedIds = useRef(new Set<number>())
  const didReportThreePosts = useRef(false)
  const didReportArrival = useRef('')
  const requestId = useRef(0)
  const loadingMoreRef = useRef(false)
  const enteredAt = useRef(Date.now())
  const loadRef = useRef<(refresh: boolean, more?: boolean) => Promise<void>>()
  const viewPageVisible = useViewPageVisible()

  useLoad((query: Query) => {
    const nextSnapshot = Number(query.snapshot_id)
    setSnapshotId(Number.isInteger(nextSnapshot) && nextSnapshot > 0 ? nextSnapshot : null)
    const postId = Number(query.post_id)
    setContextPostId(Number.isInteger(postId) && postId > 0 ? postId : null)
    setSource(query.source === 'home' ? 'home' : 'today_hot_feed')
    enteredAt.current = Date.now()
  })

  const load = useCallback(async (refresh: boolean, more = false) => {
    if (!snapshotId || (more && (!hasMore || !cursor))) return
    if (more && loadingMoreRef.current) return
    const currentRequest = ++requestId.current
    if (more) {
      loadingMoreRef.current = true
      setLoadingMore(true)
    }
    else {
      loadingMoreRef.current = false
      setLoadingMore(false)
      setLoading(true)
      setError('')
    }
    try {
      const page = await todayHotRepository.listPosts({
        snapshotId,
        cursor: more ? cursor : undefined,
        pageSize: 20,
        contextPostId: more || refresh ? undefined : contextPostId,
      })
      if (currentRequest !== requestId.current) return
      setContextUnavailable(Boolean(page.context_unavailable))
      setPosts((current) => {
        const next = more ? [...current, ...page.items] : page.items
        const ids = new Set<number>()
        return next.filter((post) => {
          if (ids.has(post.id)) return false
          ids.add(post.id)
          return true
        })
      })
      setCursor(page.next_cursor || null)
      setHasMore(Boolean(page.has_more && page.next_cursor))
      if (didReportArrival.current !== String(page.snapshot_id)) {
        didReportArrival.current = String(page.snapshot_id)
        reportTodayHotEvent('today_hot_page_arrival', { snapshotId: page.snapshot_id, source })
      }
    } catch (loadError) {
      if (currentRequest !== requestId.current) return
      setError(isApiError(loadError) && loadError.code === 'today_hot_snapshot_expired'
        ? '本轮精选已更新，下拉刷新获取最新内容'
        : '加载失败，请稍后重试')
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false)
        setLoadingMore(false)
        loadingMoreRef.current = false
        if (refresh) void Taro.stopPullDownRefresh()
      }
    }
  }, [contextPostId, cursor, hasMore, snapshotId, source])

  loadRef.current = load

  useEffect(() => { if (snapshotId) void loadRef.current?.(false) }, [reloadSignal, snapshotId])
  useEffect(() => {
    void lifeServicesRepository.listCampusCircleSections().then(({ items }) => {
      const names = new Map<number, string>()
      const visit = (section: typeof items[number]) => {
        names.set(section.id, section.name)
        section.children?.forEach(visit)
      }
      items.forEach(visit)
      setSectionNames(names)
    }).catch(() => undefined)
  }, [])
  const refreshSnapshot = useCallback(async () => {
    try {
      const home = await todayHotRepository.getHome(getTodayHotSessionWindow())
      if (!home.enabled || !home.snapshot_id) {
        setPosts([])
        setHasMore(false)
        setError('')
        return
      }
      qualifiedIds.current.clear()
      didReportThreePosts.current = false
      setContextPostId(null)
      setSnapshotId(home.snapshot_id)
      setReloadSignal((value) => value + 1)
    } catch {
      setError('加载失败，请稍后重试')
    } finally {
      void Taro.stopPullDownRefresh()
    }
  }, [])
  usePullDownRefresh(() => { void refreshSnapshot() })
  useReachBottom(() => { void load(false, true) })

  const updatePost = useCallback((post: CampusCirclePostView) => {
    setPosts((current) => current.map((item) => item.id === post.id ? post : item))
    setCommentPost((current) => current?.id === post.id ? post : current)
  }, [])

  const toggleLike = useCallback(async (post: CampusCirclePostView) => {
    try {
      const next = post.liked
        ? await lifeServicesRepository.unlikeCampusCirclePost(post.id)
        : await lifeServicesRepository.likeCampusCirclePost(post.id)
      updatePost(next)
      if (!post.liked && Date.now() - enteredAt.current <= 10 * 60_000) {
        reportTodayHotEvent('today_hot_interaction', { snapshotId: snapshotId || undefined, source, postId: post.id })
      }
    } catch (toggleError) {
      Taro.showToast({ title: isApiError(toggleError) ? toggleError.message : '操作失败', icon: 'none' })
    }
  }, [snapshotId, source, updatePost])

  const openPost = useCallback((post: CampusCirclePostView) => {
    saveCommunityDetailSnapshot(post)
    void Taro.navigateTo({
      url: `/pages/community/detail?id=${post.id}&mode=post&snapshot=1&today_hot_snapshot=${encodeURIComponent(String(snapshotId || ''))}&source=${source}`,
    })
  }, [snapshotId, source])

  const qualifyPost = useCallback((postId: number) => {
    qualifiedIds.current.add(postId)
    if (qualifiedIds.current.size < 3 || didReportThreePosts.current) return
    didReportThreePosts.current = true
    if (Date.now() - enteredAt.current <= 10 * 60_000) {
      reportTodayHotEvent('today_hot_three_post_engagement', { snapshotId: snapshotId || undefined, source, postId })
    }
  }, [snapshotId, source])

  const updateComment = useCallback((comment: CommentView) => {
    setPosts((current) => current.map((post) => post.id === comment.target_id ? {
      ...post,
      comment_count: Math.max(0, post.comment_count + 1),
      comment_previews: mergePublicCommentPreview(post.comment_previews, comment),
    } : post))
    if (Date.now() - enteredAt.current <= 10 * 60_000) {
      reportTodayHotEvent('today_hot_interaction', { snapshotId: snapshotId || undefined, source, postId: comment.target_id })
    }
  }, [snapshotId, source])

  const showEnd = !loading && !error && posts.length > 0 && !hasMore

  return (
    <View className='today-hot-page'>
      <CustomNavbar title='今日上头' showBack />
      <View className='today-hot-page__intro'>看看校园里正在聊什么</View>
      {contextUnavailable && (
        <View className='today-hot-page__notice'>你点开的动态暂不可见，已为你展示其他精选内容</View>
      )}
      {loading && posts.length === 0 && <View className='today-hot-page__state'>正在加载精选动态…</View>}
      {!loading && error && (
        <View className='today-hot-page__state today-hot-page__state--error'>
          <Text>{error}</Text>
          <View onClick={() => void load(false)}>重新加载</View>
          <View className='today-hot-page__community-button' onClick={() => void openTodayHotCommunity(snapshotId || undefined)}>
            去社区看看新动态
          </View>
        </View>
      )}
      {!loading && !error && posts.length === 0 && (
        <View className='today-hot-page__empty'>
          <Text>暂时没有精选动态</Text>
          <View className='today-hot-page__community-button' onClick={() => void openTodayHotCommunity(snapshotId || undefined)}>
            去社区看看新动态
          </View>
        </View>
      )}
      {posts.length > 0 && (
        <View className='today-hot-page__list'>
          {posts.map((post) => (
            <View id={`today-hot-probe-${post.id}`} key={post.id}>
              <TodayHotEngagementProbe postId={post.id} enabled={viewPageVisible && !commentPost} onQualified={qualifyPost} />
              <CommunityPostCard
                post={post}
                trackViews
                viewTrackingEnabled={viewPageVisible && !commentPost}
                sectionName={sectionNames.get(post.section_id) || '校园圈'}
                onToggleLike={toggleLike}
                onOpen={openPost}
                onOpenComments={setCommentPost}
                onOpenAuthor={(item) => void openPublicProfile(item.author_id)}
              />
            </View>
          ))}
        </View>
      )}
      {loadingMore && <View className='today-hot-page__load-more'>正在加载更多…</View>}
      {showEnd && (
        <View className='today-hot-page__end'>
          <Text className='today-hot-page__end-title'>今天的热门就到这里</Text>
          <Text className='today-hot-page__end-copy'>去社区发现更多新动态</Text>
          <View className='today-hot-page__community-button' onClick={() => void openTodayHotCommunity(snapshotId || undefined)}>
            去社区看看新动态 ›
          </View>
        </View>
      )}
      {commentPost && (
        <CommunityCommentSheet
          key={commentPost.id}
          post={commentPost}
          onClose={() => setCommentPost(null)}
          onCommentCreated={updateComment}
        />
      )}
    </View>
  )
}
