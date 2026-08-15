import { useState } from 'react'
import Taro, {
  useLoad,
  usePullDownRefresh,
} from '@tarojs/taro'
import { Button, Image, Text, View } from '@tarojs/components'
import type {
  CampusCirclePostView,
  CommentView,
} from '../../api/types'
import { isApiError } from '../../api/client'
import CustomNavbar from '../../components/custom-navbar'
import { KeyboardSafeInput } from '../../components/keyboard-safe-input'
import { openContentReport } from '../../features/content-report'
import { formatDateTime, formatStatus } from '../../features/life-services/format'
import { lifeServicesRepository } from '../../features/life-services/repository'
import { markLifeHubSectionDirty } from '../../features/life-services/refresh-policy'
import { requestWechatSubscriptionForModule } from '../../features/wechat-subscription'
import {
  communityAuthorAvatarUrl,
  communityAuthorInitial,
  communityAuthorName,
  communityAuthorTone,
} from '../../features/community/author'
import {
  buildCampusCircleCommentInput,
  commentReplyTargetName,
  commentRootId,
  mergeLocalThreadReply,
} from '../../features/community/comments'
import CommunityLevelBadge from '../../features/community/level-badge'
import { useCampusShare } from '../../features/share'
import './detail.scss'

const communityDetailIcons = {
  comment: require('../../assets/community/comment.svg'),
  edit: require('../../assets/community/edit.svg'),
  heart: require('../../assets/community/heart.svg'),
  heartActive: require('../../assets/community/heart-active.svg'),
  send: require('../../assets/community/send.svg'),
  share: require('../../assets/community/share.svg'),
}

type CommentThreadState = {
  descendants: CommentView[]
  error: string
  expanded: boolean
  loaded: boolean
  loading: boolean
}

const displayableComments = (items: CommentView[]) => (
  items.filter((item) => item.status !== 'withdrawn')
)

const previewThreadStates = (items: CommentView[]) => items.reduce<
Record<number, CommentThreadState>
>((result, item) => {
  const replyPreview = item.reply_preview || []
  if (item.reply_count > 0 || replyPreview.length > 0) {
    result[item.id] = {
      descendants: displayableComments(replyPreview),
      error: '',
      expanded: false,
      loaded: item.reply_count <= replyPreview.length,
      loading: false,
    }
  }
  return result
}, {})

export default function CommunityDetailPage() {
  const [postId, setPostId] = useState(0)
  const [post, setPost] = useState<CampusCirclePostView | null>(null)
  const [comments, setComments] = useState<CommentView[]>([])
  const [commentPage, setCommentPage] = useState(1)
  const [commentTotal, setCommentTotal] = useState(0)
  const [loadingMoreComments, setLoadingMoreComments] = useState(false)
  const [commentThreads, setCommentThreads] = useState<Record<number, CommentThreadState>>({})
  const [comment, setComment] = useState('')
  const [replyTarget, setReplyTarget] = useState<CommentView | null>(null)
  const [commentComposerOpen, setCommentComposerOpen] = useState(false)
  const [commentInputFocused, setCommentInputFocused] = useState(false)
  const [focusedCommentId, setFocusedCommentId] = useState(0)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deletingPost, setDeletingPost] = useState(false)
  const [deletingCommentId, setDeletingCommentId] = useState(0)
  const [error, setError] = useState('')

  const load = async (id: number, commentId = 0) => {
    setLoading(true)
    setError('')
    setCommentThreads({})
    setReplyTarget(null)
    setComment('')
    setCommentComposerOpen(false)
    setCommentInputFocused(false)
    setKeyboardHeight(0)
    try {
      const postResult = await lifeServicesRepository.getCampusCirclePost(id)
      setPost(postResult)
      if (postResult.status === 'approved') {
        const commentResult = await lifeServicesRepository.listComments(
          'campus_circle_post',
          id,
          {
            page: 1,
            pageSize: 20,
          },
        )
        let nextComments = displayableComments(commentResult.items)
        let nextThreads = previewThreadStates(nextComments)
        if (commentId > 0) {
          try {
            const focusedThread = await lifeServicesRepository.getCommentThread(commentId)
            nextComments = [focusedThread.root, ...nextComments.filter(
              (item) => item.id !== focusedThread.root.id,
            )]
            nextThreads = {
              ...nextThreads,
              [focusedThread.root.id]: {
                descendants: displayableComments(focusedThread.descendants),
                error: '',
                expanded: true,
                loaded: true,
                loading: false,
              },
            }
          } catch (focusError) {
            Taro.showToast({
              title: isApiError(focusError) ? focusError.message : '对应评论暂时无法查看',
              icon: 'none',
            })
          }
        }
        setComments(nextComments)
        setCommentThreads(nextThreads)
        setCommentPage(commentResult.page)
        setCommentTotal(Number(commentResult.total))
        setFocusedCommentId(commentId)
        if (commentId > 0) {
          setTimeout(() => {
            void Taro.pageScrollTo({
              selector: `#community-comment-${commentId}`,
              duration: 260,
            })
          }, 120)
        }
      } else {
        setComments([])
        setCommentPage(1)
        setCommentTotal(0)
      }
    } catch (loadError) {
      setError(isApiError(loadError) ? loadError.message : '动态加载失败，请稍后重试')
    } finally {
      setLoading(false)
      Taro.stopPullDownRefresh()
    }
  }

  useLoad((options) => {
    const id = Number(options.id)
    const commentId = Number(options.comment_id)
    if (!Number.isFinite(id) || id <= 0) {
      setLoading(false)
      setError('动态地址无效')
      return
    }
    setPostId(id)
    void load(id, Number.isFinite(commentId) && commentId > 0 ? commentId : 0)
  })

  usePullDownRefresh(() => {
    if (postId) void load(postId, focusedCommentId)
    else Taro.stopPullDownRefresh()
  })

  useCampusShare(() => ({
    title: post?.content?.trim().slice(0, 28) || '海大校园动态',
    path: '/pages/community/detail',
    query: { id: postId, mode: 'post' },
    imageUrl: post?.images[0]?.url,
  }))

  const toggleLike = async () => {
    if (!post) return
    try {
      const result = post.liked
        ? await lifeServicesRepository.unlikeCampusCirclePost(post.id)
        : await lifeServicesRepository.likeCampusCirclePost(post.id)
      setPost(result)
      markLifeHubSectionDirty('community')
    } catch (actionError) {
      if (isApiError(actionError) && actionError.code === 'academic_verification_required') return
      Taro.showToast({
        title: isApiError(actionError) ? actionError.message : '操作失败',
        icon: 'none',
      })
    }
  }

  const closeCommentComposer = () => {
    setCommentComposerOpen(false)
    setCommentInputFocused(false)
    setKeyboardHeight(0)
    void Taro.hideKeyboard()
  }

  const cancelReply = () => {
    setReplyTarget(null)
    setComment('')
    closeCommentComposer()
  }

  const loadCommentThread = async (rootId: number) => {
    setCommentThreads((current) => ({
      ...current,
      [rootId]: {
        descendants: current[rootId]?.descendants || [],
        error: '',
        expanded: true,
        loaded: current[rootId]?.loaded || false,
        loading: true,
      },
    }))
    try {
      const result = await lifeServicesRepository.getCommentThread(rootId)
      setComments((current) => current.map((item) => (
        item.id === result.root.id
          ? {
            ...result.root,
            reply_count: Math.max(item.reply_count, result.root.reply_count),
          }
          : item
      )))
      setCommentThreads((current) => {
        const descendants = new Map(
          (current[result.root.id]?.descendants || []).map((item) => [item.id, item]),
        )
        result.descendants.forEach((item) => descendants.set(item.id, item))
        return {
          ...current,
          [result.root.id]: {
            descendants: [...descendants.values()].sort((left, right) => left.id - right.id),
            error: '',
            expanded: true,
            loaded: true,
            loading: false,
          },
        }
      })
    } catch (loadError) {
      setCommentThreads((current) => ({
        ...current,
        [rootId]: {
          descendants: current[rootId]?.descendants || [],
          error: isApiError(loadError) ? loadError.message : '回复加载失败，请稍后重试',
          expanded: true,
          loaded: current[rootId]?.loaded || false,
          loading: false,
        },
      }))
    }
  }

  const toggleCommentThread = (root: CommentView) => {
    const current = commentThreads[root.id]
    if (!current?.loaded) {
      if (!current?.loading) void loadCommentThread(root.id)
      return
    }
    setCommentThreads((threads) => ({
      ...threads,
      [root.id]: { ...threads[root.id], expanded: !threads[root.id].expanded },
    }))
  }

  const startReply = (target: CommentView) => {
    const rootId = commentRootId(target)
    setReplyTarget(target)
    setComment('')
    setCommentComposerOpen(true)
    setCommentInputFocused(true)
    setCommentThreads((current) => current[rootId]
      ? {
        ...current,
        [rootId]: { ...current[rootId], expanded: true },
      }
      : current)
    if (!commentThreads[rootId]?.loaded && !commentThreads[rootId]?.loading) {
      void loadCommentThread(rootId)
    }
  }

  const submitComment = async () => {
    const value = comment.trim()
    if (!value || !post || post.status !== 'approved' || submitting) {
      if (!value) Taro.showToast({ title: '请输入评论内容', icon: 'none' })
      return
    }
    const activeReplyTarget = replyTarget
    setSubmitting(true)
    try {
      const created = await lifeServicesRepository.createComment(
        buildCampusCircleCommentInput(post.id, value, activeReplyTarget),
      )
      if (activeReplyTarget) {
        const rootId = commentRootId(activeReplyTarget)
        setComments((current) => current.map((item) => (
          item.id === rootId
            ? { ...item, reply_count: item.reply_count + 1 }
            : item
        )))
        setCommentThreads((current) => ({
          ...current,
          [rootId]: {
            descendants: mergeLocalThreadReply(
              current[rootId]?.descendants || [],
              created,
            ),
            error: '',
            expanded: true,
            loaded: current[rootId]?.loaded || false,
            loading: current[rootId]?.loading || false,
          },
        }))
      } else {
        setComments((current) => current.some((item) => item.id === created.id)
          ? current
          : [...current, created])
        setCommentTotal((current) => current + 1)
      }
      if (created.status === 'approved') {
        setPost((current) => current
          ? { ...current, comment_count: current.comment_count + 1 }
          : current)
      }
      setComment('')
      setReplyTarget(null)
      markLifeHubSectionDirty('community')
      closeCommentComposer()
      Taro.showToast({
        title: created.status === 'approved'
          ? activeReplyTarget ? '回复已发布' : '评论已发布'
          : activeReplyTarget ? '回复已提交审核' : '评论已提交审核',
        icon: 'success',
      })
    } catch (actionError) {
      if (isApiError(actionError) && actionError.code === 'academic_verification_required') return
      Taro.showToast({
        title: isApiError(actionError) ? actionError.message : '评论发布失败',
        icon: 'none',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const editPost = () => {
    if (!post) return
    requestWechatSubscriptionForModule('community')
    Taro.navigateTo({
      url: `/pages/publish/index?section=community&mode=edit&id=${post.id}`,
    })
  }

  const deletePost = async () => {
    if (!post || deletingPost) return
    const confirmation = await Taro.showModal({
      title: '删除动态',
      content: '删除后这条动态和评论将不再公开展示，且无法恢复。确认删除吗？',
      confirmText: '删除',
      confirmColor: '#d87567',
    })
    if (!confirmation.confirm) return

    setDeletingPost(true)
    try {
      await lifeServicesRepository.withdrawCampusCirclePost(post.id, post.version)
      markLifeHubSectionDirty('community')
      Taro.showToast({ title: '动态已删除', icon: 'success' })
      void Taro.switchTab({ url: '/pages/community/index' })
    } catch (actionError) {
      if (isApiError(actionError) && actionError.statusCode === 409) {
        await load(post.id)
      }
      Taro.showToast({
        title: isApiError(actionError) ? actionError.message : '删除失败，请稍后重试',
        icon: 'none',
      })
    } finally {
      setDeletingPost(false)
    }
  }

  const deleteComment = async (item: CommentView) => {
    if (deletingCommentId) return
    const isReply = Boolean(item.parent_id)
    const confirmation = await Taro.showModal({
      title: isReply ? '删除回复' : '删除评论',
      content: `删除后这条${isReply ? '回复' : '评论'}将不再展示，且无法恢复。确认删除吗？`,
      confirmText: '删除',
      confirmColor: '#d87567',
    })
    if (!confirmation.confirm) return

    setDeletingCommentId(item.id)
    try {
      await lifeServicesRepository.withdrawComment(item.id, item.version)
      if (isReply) {
        const rootId = commentRootId(item)
        setCommentThreads((current) => {
          const thread = current[rootId]
          if (!thread) return current
          return {
            ...current,
            [rootId]: {
              ...thread,
              descendants: thread.descendants.filter((reply) => reply.id !== item.id),
            },
          }
        })
        setComments((current) => current.map((commentItem) => (
          commentItem.id === rootId
            ? { ...commentItem, reply_count: Math.max(0, commentItem.reply_count - 1) }
            : commentItem
        )))
        if (replyTarget?.id === item.id) cancelReply()
        if (item.status === 'approved') {
          setPost((current) => current
            ? { ...current, comment_count: Math.max(0, current.comment_count - 1) }
            : current)
        }
      } else {
        setComments((current) => current.filter((commentItem) => commentItem.id !== item.id))
        setCommentThreads((current) => {
          const { [item.id]: _removedThread, ...remaining } = current
          return remaining
        })
        setCommentTotal((current) => Math.max(0, current - 1))
        if (postId) {
          setPost(await lifeServicesRepository.getCampusCirclePost(postId))
        }
      }
      markLifeHubSectionDirty('community')
      Taro.showToast({ title: `${isReply ? '回复' : '评论'}已删除`, icon: 'success' })
    } catch (actionError) {
      if (isApiError(actionError) && actionError.statusCode === 409 && postId) {
        await load(postId)
      }
      Taro.showToast({
        title: isApiError(actionError) ? actionError.message : '删除失败，请稍后重试',
        icon: 'none',
      })
    } finally {
      setDeletingCommentId(0)
    }
  }

  const previewPostImage = (current: string) => {
    if (!post || !current) return
    const urls = post.images.map((image) => image.url).filter(Boolean)
    if (urls.length === 0) return
    void Taro.previewImage({
      current,
      urls,
    })
  }

  const scrollToComments = () => {
    void Taro.pageScrollTo({
      selector: '.community-detail-comments',
      duration: 180,
    })
  }

  const loadMoreComments = async () => {
    if (!post || loadingMoreComments || comments.length >= commentTotal) return
    setLoadingMoreComments(true)
    try {
      const result = await lifeServicesRepository.listComments(
        'campus_circle_post',
        post.id,
        { page: commentPage + 1, pageSize: 20 },
      )
      const resultItems = displayableComments(result.items)
      setComments((current) => {
        const byId = new Map(current.map((item) => [item.id, item]))
        resultItems.forEach((item) => byId.set(item.id, item))
        return [...byId.values()]
      })
      setCommentThreads((current) => ({
        ...previewThreadStates(resultItems),
        ...current,
      }))
      setCommentPage(result.page)
      setCommentTotal(Number(result.total))
    } catch (loadError) {
      Taro.showToast({
        title: isApiError(loadError) ? loadError.message : '更多评论加载失败',
        icon: 'none',
      })
    } finally {
      setLoadingMoreComments(false)
    }
  }

  return (
    <View className='community-detail'>
      <CustomNavbar title='动态详情' showBack />
      <View className='community-detail__content'>
        {loading && <View className='community-detail-state'>正在加载动态</View>}
        {!loading && error && (
          <View className='community-detail-state community-detail-state--error'>
            <Text>{error}</Text>
            {postId > 0 && <View onClick={() => void load(postId)}>重新加载</View>}
          </View>
        )}

        {!loading && !error && post && (
          <>
            <View className='community-detail-card'>
              <View className='community-detail-card__top'>
                <View
                  className={`community-detail-card__avatar community-detail-card__avatar--tone-${communityAuthorTone(post)}`}
                >
                  {communityAuthorAvatarUrl(post)
                    ? <Image className='community-detail-card__avatar-image' src={communityAuthorAvatarUrl(post)} mode='aspectFill' lazyLoad />
                    : communityAuthorInitial(post)}
                </View>
                <View className='community-detail-card__author'>
                  <View>
                    <Text>{communityAuthorName(post)}</Text>
                    <CommunityLevelBadge level={post.author_level} />
                  </View>
                  <Text className='community-detail-card__time'>
                    {formatDateTime(post.published_at || post.created_at)}
                  </Text>
                </View>
                <View className='community-detail-card__status'>
                  <View />
                  <Text>{formatStatus(post.status)}</Text>
                </View>
              </View>
              {post.content && (
                <Text className='community-detail-card__body'>{post.content}</Text>
              )}
              {post.images.length > 0 && (
                <View className='community-detail-card__images'>
                  {post.images.map((image) => (
                    <View key={image.id} className='community-detail-card__image-frame'>
                      {image.url && (
                        <Image
                          src={image.url}
                          mode='widthFix'
                          lazyLoad
                          onClick={() => previewPostImage(image.url)}
                        />
                      )}
                      {post.viewer_relation === 'owner' && post.status === 'pending_review' && (
                        <View className={image.url
                          ? 'community-detail-card__image-reviewing community-detail-card__image-reviewing--overlay'
                          : 'community-detail-card__image-reviewing'}
                        >
                          <Text>图片审核中</Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
              <View className='community-detail-card__actions'>
                <View
                  className={
                    post.liked
                      ? 'community-detail-card__action community-detail-card__action--liked'
                      : 'community-detail-card__action'
                  }
                  hoverClass='community-detail-card__action--pressed'
                  hoverStartTime={20}
                  hoverStayTime={120}
                  ariaRole='button'
                  ariaLabel={`${post.liked ? '取消点赞' : '点赞'}，当前 ${post.like_count} 个赞`}
                  onClick={() => void toggleLike()}
                >
                  <Image
                    src={post.liked ? communityDetailIcons.heartActive : communityDetailIcons.heart}
                    mode='aspectFit'
                  />
                  <Text>{post.like_count}</Text>
                </View>
                <View
                  className='community-detail-card__action'
                  hoverClass='community-detail-card__action--pressed'
                  hoverStartTime={20}
                  hoverStayTime={120}
                  ariaRole='button'
                  ariaLabel={`查看评论，当前 ${post.comment_count} 条评论`}
                  onClick={scrollToComments}
                >
                  <Image src={communityDetailIcons.comment} mode='aspectFit' />
                  <Text>{post.comment_count}</Text>
                </View>
                <Button
                  className='community-detail-card__action community-detail-card__action--icon'
                  openType='share'
                  hoverClass='community-detail-card__action--pressed'
                  ariaLabel='分享这条动态'
                >
                  <Image src={communityDetailIcons.share} mode='aspectFit' />
                </Button>
                {post.available_actions.includes('edit') && (
                  <View
                    id='community-detail-edit'
                    className='community-detail-card__action community-detail-card__action--icon'
                    hoverClass='community-detail-card__action--pressed'
                    hoverStartTime={20}
                    hoverStayTime={120}
                    ariaRole='button'
                    ariaLabel='编辑这条动态'
                    onClick={editPost}
                  >
                    <Image src={communityDetailIcons.edit} mode='aspectFit' />
                  </View>
                )}
                {post.available_actions.includes('withdraw') && (
                  <View
                    id='community-detail-delete'
                    className='community-detail-card__delete'
                    hoverClass='community-detail-card__action--pressed'
                    ariaRole='button'
                    ariaLabel={deletingPost ? '正在删除这条动态' : '删除这条动态'}
                    onClick={() => void deletePost()}
                  >
                    {deletingPost ? '删除中' : '删除动态'}
                  </View>
                )}
                {post.viewer_relation !== 'owner'
                  && post.viewer_relation !== 'admin' && (
                  <View
                    className='community-detail-card__report'
                    hoverClass='community-detail-card__action--pressed'
                    ariaRole='button'
                    ariaLabel='举报这条动态'
                    onClick={() => void openContentReport({
                      resourceType: 'campus_circle_post',
                      resourceId: post.id,
                      resourceVersion: post.version,
                    })}
                  >
                    举报
                  </View>
                )}
              </View>
              {post.review_reason && (
                <View className='community-detail-card__review'>
                  <Text>审核说明</Text>
                  <Text>{post.review_reason}</Text>
                </View>
              )}
            </View>

            <View className='community-detail-comments'>
              <View className='community-detail-comments__heading'>
                <View>
                  <Image src={communityDetailIcons.comment} mode='aspectFit' />
                  <Text>评论</Text>
                </View>
                <Text>{post.comment_count} 条已发布</Text>
              </View>
              {comments.map((item) => {
                const threadState = commentThreads[item.id]
                const allDescendants = threadState?.descendants || item.reply_preview || []
                const descendants = threadState?.expanded
                  ? allDescendants
                  : allDescendants.slice(0, 2)
                const threadMembers = [item, ...allDescendants]
                const hasThreadAction = Boolean(threadState?.expanded)
                  || item.reply_count > Math.min(allDescendants.length, 2)
                return (
                  <View key={item.id} className='community-comment-thread'>
                    <View
                      id={`community-comment-${item.id}`}
                      className={[
                        'community-detail-comments__item',
                        'community-comment',
                        `community-comment--${item.status}`,
                        focusedCommentId === item.id ? 'community-comment--focused' : '',
                      ].filter(Boolean).join(' ')}
                    >
                      <View
                        className={`community-detail-comments__avatar community-detail-comments__avatar--tone-${communityAuthorTone(item)}`}
                      >
                        {communityAuthorAvatarUrl(item)
                          ? <Image className='community-detail-comments__avatar-image' src={communityAuthorAvatarUrl(item)} mode='aspectFill' lazyLoad />
                          : communityAuthorInitial(item)}
                      </View>
                      <View className='community-detail-comments__copy'>
                        <View className='community-detail-comments__author'>
                          <Text>{communityAuthorName(item)}</Text>
                          {item.author_id === post.author_id && (
                            <Text className='community-comment__author-badge'>作者</Text>
                          )}
                          <CommunityLevelBadge level={item.author_level} compact />
                        </View>
                        <Text className='community-comment__content'>{item.content}</Text>
                        <View className='community-detail-comments__meta'>
                          <Text>{formatDateTime(item.created_at)}</Text>
                          {item.status !== 'approved' && (
                            <>
                              <View className='community-detail-comments__meta-separator' />
                              <Text className='community-comment__status'>
                                {formatStatus(item.status)}
                              </Text>
                            </>
                          )}
                          {item.available_actions.includes('reply') && (
                            <>
                              <View className='community-detail-comments__meta-separator' />
                              <Text
                                id={`community-comment-reply-${item.id}`}
                                className='community-comment__reply-action'
                                onClick={() => startReply(item)}
                              >
                                回复
                              </Text>
                            </>
                          )}
                          {item.viewer_relation !== 'author'
                            && item.viewer_relation !== 'admin' && (
                            <>
                              <View className='community-detail-comments__meta-separator' />
                              <Text
                                className='community-comment__report'
                                onClick={() => void openContentReport({
                                  resourceType: 'comment',
                                  resourceId: item.id,
                                  resourceVersion: item.version,
                                })}
                              >
                                举报
                              </Text>
                            </>
                          )}
                          {item.available_actions.includes('withdraw') && (
                            <>
                              <View className='community-detail-comments__meta-separator' />
                              <View
                                id={`community-comment-delete-${item.id}`}
                                className='community-comment__delete'
                                ariaRole='button'
                                ariaLabel={deletingCommentId === item.id
                                  ? '正在删除这条评论'
                                  : '删除这条评论'}
                                onClick={() => void deleteComment(item)}
                              >
                                {deletingCommentId === item.id ? '删除中' : '删除'}
                              </View>
                            </>
                          )}
                        </View>
                        {hasThreadAction && (
                          <View
                            id={`community-comment-thread-${item.id}`}
                            className='community-comment__thread-action'
                            ariaRole='button'
                            ariaLabel={threadState?.expanded ? '收起回复' : '查看回复'}
                            onClick={() => toggleCommentThread(item)}
                          >
                            {threadState?.loading
                              ? '加载回复中…'
                              : threadState?.expanded
                                ? '收起回复'
                                : `查看全部 ${item.reply_count} 条回复`}
                          </View>
                        )}
                      </View>
                    </View>

                    {threadState?.error && (
                      <View
                        className='community-comment__thread-error'
                        onClick={() => void loadCommentThread(item.id)}
                      >
                        {threadState.error}，点击重试
                      </View>
                    )}

                    {descendants.length > 0 && (
                      <View className='community-comment__replies'>
                        {descendants.map((reply) => {
                          const replyToName = commentReplyTargetName(reply, threadMembers)
                          return (
                            <View
                              id={`community-comment-${reply.id}`}
                              key={reply.id}
                              className={[
                                'community-comment__reply',
                                'community-comment',
                                `community-comment--${reply.status}`,
                                focusedCommentId === reply.id ? 'community-comment--focused' : '',
                              ].filter(Boolean).join(' ')}
                            >
                              <View
                                className={`community-comment__reply-avatar community-detail-comments__avatar--tone-${communityAuthorTone(reply)}`}
                              >
                                {communityAuthorAvatarUrl(reply)
                                  ? <Image className='community-comment__reply-avatar-image' src={communityAuthorAvatarUrl(reply)} mode='aspectFill' lazyLoad />
                                  : communityAuthorInitial(reply)}
                              </View>
                              <View className='community-comment__reply-copy'>
                                <View className='community-comment__reply-author'>
                                  <Text>{communityAuthorName(reply)}</Text>
                                  {reply.author_id === post.author_id && (
                                    <Text className='community-comment__author-badge'>作者</Text>
                                  )}
                                  {replyToName && (
                                    <Text className='community-comment__reply-target'>
                                      ▸ {replyToName}
                                    </Text>
                                  )}
                                  <CommunityLevelBadge level={reply.author_level} compact />
                                </View>
                                <Text className='community-comment__reply-content'>
                                  {reply.content}
                                </Text>
                                <View className='community-detail-comments__meta'>
                                  <Text>{formatDateTime(reply.created_at)}</Text>
                                  {reply.status !== 'approved' && (
                                    <>
                                      <View className='community-detail-comments__meta-separator' />
                                      <Text className='community-comment__status'>
                                        {formatStatus(reply.status)}
                                      </Text>
                                    </>
                                  )}
                                  {reply.available_actions.includes('reply') && (
                                    <>
                                      <View className='community-detail-comments__meta-separator' />
                                      <Text
                                        id={`community-comment-reply-${reply.id}`}
                                        className='community-comment__reply-action'
                                        onClick={() => startReply(reply)}
                                      >
                                        回复
                                      </Text>
                                    </>
                                  )}
                                  {reply.viewer_relation !== 'author'
                                    && reply.viewer_relation !== 'admin' && (
                                    <>
                                      <View className='community-detail-comments__meta-separator' />
                                      <Text
                                        className='community-comment__report'
                                        onClick={() => void openContentReport({
                                          resourceType: 'comment',
                                          resourceId: reply.id,
                                          resourceVersion: reply.version,
                                        })}
                                      >
                                        举报
                                      </Text>
                                    </>
                                  )}
                                  {reply.available_actions.includes('withdraw') && (
                                    <>
                                      <View className='community-detail-comments__meta-separator' />
                                      <View
                                        id={`community-comment-delete-${reply.id}`}
                                        className='community-comment__delete'
                                        ariaRole='button'
                                        ariaLabel={deletingCommentId === reply.id
                                          ? '正在删除这条回复'
                                          : '删除这条回复'}
                                        onClick={() => void deleteComment(reply)}
                                      >
                                        {deletingCommentId === reply.id ? '删除中' : '删除'}
                                      </View>
                                    </>
                                  )}
                                </View>
                              </View>
                            </View>
                          )
                        })}
                      </View>
                    )}
                  </View>
                )
              })}
              {comments.length === 0 && (
                <View className='community-detail-comments__empty'>
                  <View>
                    <Image src={communityDetailIcons.comment} mode='aspectFit' />
                  </View>
                  <Text>{post.status === 'approved' ? '还没有评论' : '评论暂未开放'}</Text>
                  <Text>
                    {post.status === 'approved'
                      ? '来友善地聊聊吧'
                      : '动态审核通过后即可参与讨论'}
                  </Text>
                </View>
              )}
              {comments.length < commentTotal && (
                <View
                  id='community-comments-load-more'
                  className='community-detail-comments__load-more'
                  onClick={() => void loadMoreComments()}
                >
                  {loadingMoreComments ? '正在加载' : '查看更多评论'}
                </View>
              )}
            </View>

            {post.status === 'approved' && (
              <>
                {commentComposerOpen && (
                  <View
                    className='community-detail-comments__composer-backdrop'
                    catchMove
                    ariaRole='button'
                    ariaLabel={replyTarget ? '取消回复' : '关闭评论输入'}
                    onClick={replyTarget ? cancelReply : closeCommentComposer}
                  />
                )}
                <View
                  className={[
                    'community-detail-comments__composer',
                    commentComposerOpen
                      ? 'community-detail-comments__composer--open'
                      : '',
                  ].filter(Boolean).join(' ')}
                  style={{ bottom: `${keyboardHeight}px` }}
                >
                  {replyTarget && (
                    <View
                      id={`community-replying-to-${replyTarget.id}`}
                      className='community-detail-comments__replying'
                    >
                      <Text>正在回复 @{communityAuthorName(replyTarget)}</Text>
                      <View
                        id='community-comment-cancel-reply'
                        ariaRole='button'
                        ariaLabel='取消回复'
                        onClick={submitting ? undefined : cancelReply}
                      >
                        取消
                      </View>
                    </View>
                  )}
                  <View className='community-detail-comments__composer-main'>
                    <KeyboardSafeInput
                      id='community-comment-input'
                      value={comment}
                      focus={commentInputFocused}
                      disabled={submitting}
                      maxlength={300}
                      confirmType='send'
                      cursorSpacing={18}
                      keepVisibleOnKeyboard={false}
                      placeholder={replyTarget
                        ? `回复 @${communityAuthorName(replyTarget)}`
                        : '友善交流，分享你的想法'}
                      placeholderClass='community-detail-comments__placeholder'
                      onFocus={(event) => {
                        setCommentInputFocused(true)
                        setCommentComposerOpen(true)
                        setKeyboardHeight(Math.max(0, event.detail.height || 0))
                      }}
                      onBlur={() => {
                        setCommentInputFocused(false)
                        setKeyboardHeight(0)
                      }}
                      onKeyboardHeightChange={(event) => {
                        const height = Math.max(0, event.detail.height || 0)
                        setKeyboardHeight(height)
                        if (height === 0) {
                          setCommentInputFocused(false)
                          setCommentComposerOpen(false)
                        }
                      }}
                      onInput={(event) => setComment(event.detail.value)}
                      onConfirm={() => void submitComment()}
                    />
                    <View
                      id='community-comment-submit'
                      className={
                        submitting || !comment.trim()
                          ? 'community-detail-comments__send community-detail-comments__send--disabled'
                          : 'community-detail-comments__send'
                      }
                      hoverClass='community-detail-comments__send--pressed'
                      hoverStartTime={20}
                      hoverStayTime={120}
                      ariaRole='button'
                      ariaLabel={submitting
                        ? replyTarget ? '回复发送中' : '评论发送中'
                        : replyTarget ? '发送回复' : '发送评论'}
                      onClick={() => void submitComment()}
                    >
                      <Image src={communityDetailIcons.send} mode='aspectFit' />
                    </View>
                  </View>
                </View>
              </>
            )}
          </>
        )}
      </View>
    </View>
  )
}
