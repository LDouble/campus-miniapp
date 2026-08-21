import { useCallback, useRef, useState } from 'react'
import Taro, { useLoad, usePullDownRefresh } from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import type { CampusCirclePostView, CampusCircleTopicView } from '../../../../api/types'
import { isApiError } from '../../../../api/client'
import CustomNavbar from '../../../../components/custom-navbar'
import {
  communityTopicPublisherUrl,
  parsePositiveId,
  topicPeriodLabel,
} from '../../../../features/community/topic'
import { lifeServicesRepository } from '../../../../features/life-services/repository'
import { markLifeHubSectionDirty } from '../../../../features/life-services/refresh-policy'
import CommunityCommentSheet from '../../../../features/community/comment-sheet'
import CommunityPostCard, { type CommunityPostCommentPreview } from '../../../../features/community/post-card'
import { mergePublicCommentPreview } from '../../../../features/community/comments'
import { saveCommunityDetailSnapshot } from '../../../../features/community/detail-snapshot'
import { useDismissCommunityOverlaysOnScroll } from '../../../../features/community/use-overlay-dismissal'
import { useCampusShare } from '../../../../features/share'
import './index.scss'
import { openPublicProfile } from '../../../../features/profile/public-profile'

const TOPIC_POSTS_PAGE_SIZE = 20

const mergeUniquePosts = (
  current: CampusCirclePostView[],
  incoming: CampusCirclePostView[],
) => {
  const seen = new Set(current.map((post) => post.id))
  return [...current, ...incoming.filter((post) => {
    if (seen.has(post.id)) return false
    seen.add(post.id)
    return true
  })]
}

export default function CommunityTopicPage() {
  const [topic, setTopic] = useState<CampusCircleTopicView | null>(null)
  const [posts, setPosts] = useState<CampusCirclePostView[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [topicId, setTopicId] = useState(0)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [commentPost, setCommentPost] = useState<CampusCirclePostView | null>(null)
  const [commentReplyTarget, setCommentReplyTarget] = useState<CommunityPostCommentPreview | null>(null)
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [commentDismissSignal, setCommentDismissSignal] = useState(0)
  const [openActionPostId, setOpenActionPostId] = useState<number | null>(null)
  const requestSequence = useRef(0)

  const load = useCallback(async (id: number, nextPage = 1, append = false) => {
    if (!Number.isInteger(id) || id < 1) {
      setLoading(false)
      setLoadingMore(false)
      setError('话题参数无效')
      Taro.stopPullDownRefresh()
      return
    }

    const requestId = ++requestSequence.current
    if (append) setLoadingMore(true)
    else {
      setLoading(true)
      setError('')
    }

    try {
      if (append) {
        const postsResult = await lifeServicesRepository.listCampusCirclePosts({
          topicId: id,
          page: nextPage,
          pageSize: TOPIC_POSTS_PAGE_SIZE,
        })
        if (requestId !== requestSequence.current) return
        setPosts((current) => mergeUniquePosts(current, postsResult.items))
        setPage(postsResult.page)
        setTotal(Number(postsResult.total))
        return
      }

      const [topicResult, postsResult] = await Promise.all([
        lifeServicesRepository.getCampusCircleTopic(id),
        lifeServicesRepository.listCampusCirclePosts({
          topicId: id,
          page: nextPage,
          pageSize: TOPIC_POSTS_PAGE_SIZE,
        }),
      ])
      if (requestId !== requestSequence.current) return
      setTopic(topicResult)
      setPosts(mergeUniquePosts([], postsResult.items))
      setPage(postsResult.page)
      setTotal(Number(postsResult.total))
    } catch (loadError) {
      if (requestId !== requestSequence.current) return
      const message = isApiError(loadError) ? loadError.message : '话题加载失败'
      if (append) {
        Taro.showToast({ title: message, icon: 'none' })
      } else {
        setError(message)
      }
    } finally {
      if (requestId === requestSequence.current) {
        setLoading(false)
        setLoadingMore(false)
        Taro.stopPullDownRefresh()
      }
    }
  }, [])

  useLoad((options) => {
    const id = parsePositiveId(options.id)
    setTopicId(id)
    void load(id)
  })
  usePullDownRefresh(useCallback(() => {
    void load(topicId)
  }, [load, topicId]))

  useCampusShare((event) => {
    const dataset = event.target?.dataset || {}
    const postId = Number(dataset.postId)
    if (event.from === 'button' && postId > 0) {
      const shareTitle = typeof dataset.shareTitle === 'string'
        ? dataset.shareTitle
        : '海大校园动态'
      const shareImage = typeof dataset.shareImage === 'string'
        ? dataset.shareImage
        : ''
      const result = {
        title: shareTitle,
        path: '/packages/social/community/detail',
        query: { id: postId, mode: 'post' },
      }
      return shareImage ? { ...result, imageUrl: shareImage } : result
    }
    return {
      title: topic ? `#${topic.name}｜海大校园话题` : '海大校园话题',
      path: topicId ? '/packages/social/community/topic/index' : '/pages/community/index',
      query: topicId ? { id: topicId } : undefined,
      imageUrl: topic?.cover_url || undefined,
    }
  })

  const toggleLike = useCallback(async (post: CampusCirclePostView) => {
    const updated = post.liked
      ? await lifeServicesRepository.unlikeCampusCirclePost(post.id)
      : await lifeServicesRepository.likeCampusCirclePost(post.id)
    setPosts((current) => current.map((item) => item.id === updated.id ? updated : item))
    markLifeHubSectionDirty('community')
  }, [])
  const openPost = useCallback((post: CampusCirclePostView) => {
    setOpenActionPostId(null)
    saveCommunityDetailSnapshot(post)
    return Taro.navigateTo({ url: `/packages/social/community/detail?id=${post.id}&mode=post&snapshot=1` })
  }, [])
  const openComments = useCallback((post: CampusCirclePostView) => {
    setOpenActionPostId(null)
    setCommentSubmitting(false)
    setCommentReplyTarget(null)
    setCommentPost(post)
  }, [])
  const openReply = useCallback((post: CampusCirclePostView, comment: CommunityPostCommentPreview) => {
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
  const dismissCommunityOverlays = useCallback(() => {
    setOpenActionPostId(null)
    if (commentPost) setCommentDismissSignal((current) => current + 1)
  }, [commentPost])
  useDismissCommunityOverlaysOnScroll({
    active: openActionPostId !== null || (commentPost !== null && !commentSubmitting),
    onDismiss: dismissCommunityOverlays,
  })
  const updateCommentCount = useCallback((postId: number, delta: number) => {
    setPosts((current) => current.map((item) => (
      item.id === postId
        ? { ...item, comment_count: Math.max(0, item.comment_count + delta) }
        : item
    )))
  }, [])
  const openPublisher = useCallback(() => {
    if (!topic) return
    return Taro.navigateTo({ url: communityTopicPublisherUrl(topic.id) })
  }, [topic])
  const openPostAuthor = useCallback((post: CampusCirclePostView) => {
    void openPublicProfile(post.author_id)
  }, [])
  const reload = useCallback(() => {
    void load(topicId)
  }, [load, topicId])
  const loadMore = useCallback(() => {
    if (loading || loadingMore || posts.length >= total) return
    void load(topicId, page + 1, true)
  }, [load, loading, loadingMore, page, posts.length, topicId, total])

  const topicLabel = topic?.kind === 'campaign'
    ? '校园活动'
    : topic?.is_hot
      ? '热门话题'
      : '校园话题'
  const participateLabel = topic?.kind === 'campaign' ? '参与活动' : '参与讨论'
  const periodLabel = topic ? topicPeriodLabel(topic) : ''

  return <View className='community-topic-page'>
    <CustomNavbar title={topic?.name || topicLabel} showBack />
    <View className='community-topic-page__content'>
      {topic && (
        <View className={`community-topic-hero ${topic.cover_url ? 'community-topic-hero--covered' : ''}`}>
          {topic.cover_url && <Image className='community-topic-hero__cover' src={topic.cover_url} mode='aspectFill' />}
          <View className='community-topic-hero__glow' />
          <View className='community-topic-hero__content'>
            <View className='community-topic-hero__eyebrow'>
              <Text>{topicLabel}</Text>
              {topic.is_hot && topic.kind === 'campaign' && <Text>热门</Text>}
            </View>
            <Text className='community-topic-hero__title'>#{topic.name}</Text>
            <Text className='community-topic-hero__description'>
              {topic.description || '和海大同学一起分享观点与校园见闻'}
            </Text>
            <View className='community-topic-hero__footer'>
              <View className='community-topic-hero__meta'>
                <Text>{topic.post_count} 条动态</Text>
                {periodLabel && <Text>{periodLabel}</Text>}
              </View>
              <View
                className='community-topic-hero__action'
                ariaRole='button'
                ariaLabel={`${participateLabel}：${topic.name}`}
                onClick={openPublisher}
              >
                <Text>{participateLabel}</Text>
                <Text>＋</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {!loading && !error && topic && (
        <View className='community-topic-feed-heading'>
          <View>
            <Text>话题动态</Text>
            <Text>看看同学们正在聊什么</Text>
          </View>
          <Text>{topic.post_count} 条</Text>
        </View>
      )}

      {loading && <View className='community-topic-page__state'>正在加载讨论</View>}
      {!loading && error && (
        <View className='community-topic-page__state community-topic-page__state--error'>
          <Text>{error}</Text>
          <View
            className='community-topic-page__retry'
            ariaRole='button'
            ariaLabel='重新加载话题'
            onClick={reload}
          >重新加载</View>
        </View>
      )}
      {!loading && !error && posts.map((post) => (
        <CommunityPostCard
          key={post.id}
          post={post}
          sectionName='校园社区'
          actionsOpen={openActionPostId === post.id}
          onToggleActions={toggleActions}
          onCloseActions={closeActions}
          onToggleLike={toggleLike}
          onOpen={openPost}
          onOpenComments={openComments}
          onReplyComment={openReply}
          onOpenAuthor={openPostAuthor}
        />
      ))}
      {!loading && !error && topic && posts.length === 0 && (
        <View className='community-topic-empty'>
          <View>OUC</View>
          <Text>还没有人发布动态</Text>
          <Text>带上这个话题，成为第一个参与讨论的人</Text>
          <View
            className='community-topic-empty__action'
            ariaRole='button'
            ariaLabel={`${participateLabel}：${topic.name}`}
            onClick={openPublisher}
          >
            {participateLabel}
          </View>
        </View>
      )}
      {!loading && !error && posts.length < total && (
        <View
          className='api-community-load-more'
          ariaRole='button'
          ariaLabel={loadingMore ? '正在加载更多话题动态' : '查看更多话题动态'}
          onClick={loadMore}
        >
          {loadingMore ? '正在加载…' : '查看更多'}
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
  </View>
}
