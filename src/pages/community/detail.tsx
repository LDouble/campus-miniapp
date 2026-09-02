import { useState } from 'react'
import Taro, {
  useLoad,
  usePullDownRefresh,
} from '@tarojs/taro'
import { Button, Image, Text, View } from '@tarojs/components'
import type { CampusCirclePostView } from '../../api/types'
import { isApiError } from '../../api/client'
import CustomNavbar from '../../components/custom-navbar'
import MentionContent from '../../components/mention-content'
import {
  communityAuthorAvatarUrl,
  communityAuthorInitial,
  communityAuthorName,
} from '../../features/community/author'
import { consumeCommunityDetailSnapshot } from '../../features/community/detail-snapshot'
import { communityPostTopics, communityTopicUrl } from '../../features/community/topic'
import CommunityLevelBadge from '../../features/community/level-badge'
import { openContentReport } from '../../features/content-report'
import FavoriteToggle from '../../features/favorites/favorite-toggle'
import DetailAuthorHeader from '../../features/life-services/components/detail-author-header'
import DetailComments from '../../features/life-services/components/detail-comments'
import ContentImageGrid from '../../features/community/components/content-image-grid'
import { buildDetailFooterActions } from '../../features/life-services/detail-actions'
import { formatDateTime, formatStatus } from '../../features/life-services/format'
import { markLifeHubSectionDirty } from '../../features/life-services/refresh-policy'
import { lifeServicesRepository } from '../../features/life-services/repository'
import { useCampusShare } from '../../features/share'
import { plainStickerContent } from '../../features/stickers/content'
import { requestWechatSubscriptionForModule } from '../../features/wechat-subscription'
import { showActionSheetSelection } from '../../utils/action-sheet'
import './detail.scss'

const communityDetailIcons = {
  comment: require('../../assets/community/comment.svg'),
  heart: require('../../assets/community/feed-heart.svg'),
  heartActive: require('../../assets/community/heart-active.svg'),
  more: require('../../assets/icons/more-horizontal.svg'),
  share: require('../../assets/community/detail-share.svg'),
}

const actionLabels: Record<string, string> = {
  edit: '编辑动态',
  withdraw: '删除动态',
}

const formatDetailDateTime = (value?: string | null) => (
  formatDateTime(value).replace(/^(\d{2})月(\d{2})日/u, '$1-$2')
)

export default function CommunityDetailPage() {
  const [postId, setPostId] = useState(0)
  const [post, setPost] = useState<CampusCirclePostView | null>(null)
  const [focusedCommentId, setFocusedCommentId] = useState(0)
  const [loading, setLoading] = useState(true)
  const [deletingPost, setDeletingPost] = useState(false)
  const [error, setError] = useState('')

  const load = async (id: number, commentId = 0) => {
    setLoading(true)
    setError('')
    try {
      setPost(await lifeServicesRepository.getCampusCirclePost(id))
      setFocusedCommentId(commentId)
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
    const normalizedCommentId = Number.isFinite(commentId) && commentId > 0 ? commentId : 0
    const snapshot = options.snapshot === '1'
      ? consumeCommunityDetailSnapshot(id)
      : null
    if (snapshot) {
      setPost(snapshot)
      setFocusedCommentId(normalizedCommentId)
      setError('')
      setLoading(false)
      return
    }
    void load(id, normalizedCommentId)
  })

  usePullDownRefresh(() => {
    if (postId) void load(postId, focusedCommentId)
    else Taro.stopPullDownRefresh()
  })

  useCampusShare(() => ({
    title: plainStickerContent(post?.content || '').trim().slice(0, 28) || 'OUSea动态',
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

  const editPost = () => {
    if (!post) return
    requestWechatSubscriptionForModule('community')
    void Taro.navigateTo({
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

  const canReportPost = Boolean(
    post
    && post.viewer_relation !== 'owner'
    && post.viewer_relation !== 'admin',
  )

  const reportPost = () => {
    if (!post || !canReportPost) return
    void openContentReport({
      resourceType: 'campus_circle_post',
      resourceId: post.id,
      resourceVersion: post.version,
    })
  }

  const permissionActions = post ? buildDetailFooterActions({
    availableActions: post.available_actions,
    labels: actionLabels,
    priority: ['edit', 'withdraw'],
    dangerActions: ['withdraw'],
    busy: deletingPost,
    onAction: (action) => action === 'edit' ? editPost() : void deletePost(),
  }) : []

  const postMenuItems = [
    ...permissionActions.map((action) => ({
      label: action.busy ? `${action.label}中` : action.label,
      run: action.onClick,
    })),
    ...(canReportPost ? [{ label: '举报', run: reportPost }] : []),
  ]

  const openPostMenu = async () => {
    if (postMenuItems.length === 0 || deletingPost) return
    const tapIndex = await showActionSheetSelection(postMenuItems.map((item) => item.label))
    const selected = tapIndex === null ? null : postMenuItems[tapIndex]
    if (selected) selected.run()
  }

  const scrollToComments = () => {
    void Taro.pageScrollTo({ selector: '.business-detail-comments', duration: 180 })
  }

  const openTopic = (topicId: number) => {
    const url = communityTopicUrl(topicId)
    if (url) void Taro.navigateTo({ url })
  }

  const topicLinks = post ? communityPostTopics(post) : []

  return (
    <View className='community-detail'>
      <CustomNavbar title='帖子详情' showBack />
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
            <View id='community-detail-post' className='community-detail__main'>
              <DetailAuthorHeader
                avatarUrl={communityAuthorAvatarUrl(post)}
                nickname={communityAuthorName(post)}
                fallback={communityAuthorInitial(post)}
                userId={post.author_id}
                profileEnabled={!post.author_deleted}
                badge={<CommunityLevelBadge level={post.author_level} />}
                meta={(
                  <>
                    <Text>{formatDetailDateTime(post.published_at || post.created_at)}</Text>
                    {post.status !== 'approved' && (
                      <Text className={`community-detail__review-status community-detail__review-status--${post.status}`}>
                        {formatStatus(post.status)}
                      </Text>
                    )}
                  </>
                )}
                action={(
                  <View className='community-detail__toolbar-actions'>
                    <FavoriteToggle
                      resourceId={post.id}
                      resourceType='campus_circle_post'
                      compact
                    />
                    {postMenuItems.length > 0 && (
                      <View
                        id='community-detail-more'
                        className='community-detail__more'
                        ariaRole='button'
                        ariaLabel='更多帖子操作'
                        onClick={() => void openPostMenu()}
                      >
                        <Image src={communityDetailIcons.more} mode='aspectFit' />
                      </View>
                    )}
                  </View>
                )}
              />

              {(post.content || topicLinks.length > 0) && (
                <MentionContent
                  content={post.content || ''}
                  segments={post.content_segments}
                  className='community-detail__body community-detail-card__body'
                  stickerClassName='community-detail__body-sticker'
                  trailing={topicLinks.map((topic) => (
                    <View
                      key={topic.id}
                      className='community-detail__topic'
                      ariaRole='button'
                      ariaLabel={`查看话题：${topic.name}`}
                      onClick={() => openTopic(topic.id)}
                    >
                      <Text selectable>#{topic.name}</Text>
                    </View>
                  ))}
                />
              )}

              {post.images.length > 0 && (
                <ContentImageGrid
                  images={post.images}
                  pendingReview={post.viewer_relation === 'owner' && post.status === 'pending_review'}
                  preview
                />
              )}

              <View className='community-detail__actions'>
                <View className='community-detail__action-slot'>
                  <View
                    id='community-detail-like'
                    className={post.liked
                      ? 'community-detail__action community-detail__action--liked'
                      : 'community-detail__action'}
                    ariaRole='button'
                    ariaLabel={`${post.liked ? '取消点赞' : '点赞'}，当前 ${post.like_count} 个赞`}
                    onClick={() => void toggleLike()}
                  >
                    <Image src={post.liked ? communityDetailIcons.heartActive : communityDetailIcons.heart} mode='aspectFit' />
                    <Text>{post.like_count}</Text>
                  </View>
                </View>
                <View className='community-detail__action-slot'>
                  <View
                    id='community-detail-comment'
                    className='community-detail__action'
                    ariaRole='button'
                    ariaLabel={`查看评论，当前 ${post.comment_count} 条评论`}
                    onClick={scrollToComments}
                  >
                    <Image src={communityDetailIcons.comment} mode='aspectFit' />
                    <Text>{post.comment_count}</Text>
                  </View>
                </View>
                <View className='community-detail__action-slot'>
                  <Button
                    hoverClass='none'
                    id='community-detail-share'
                    className='community-detail__action community-detail__action--share'
                    openType='share'
                    ariaLabel='分享这条动态'
                  >
                    <Image src={communityDetailIcons.share} mode='aspectFit' />
                  </Button>
                </View>
              </View>

              {post.review_reason && (
                <View className='community-detail__review community-detail-card__review'>
                  <Text selectable>审核说明</Text>
                  <Text selectable>{post.review_reason}</Text>
                </View>
              )}
            </View>

            <DetailComments
              targetType='campus_circle_post'
              targetId={post.id}
              enabled={post.status === 'approved'}
              targetAuthorId={post.author_id}
              initialCommentId={focusedCommentId}
              showHeading={false}
              placeholder='友善交流，分享你的想法'
              tone='community'
              onApprovedDelta={(delta) => setPost((current) => current
                ? { ...current, comment_count: Math.max(0, current.comment_count + delta) }
                : current)}
              onMutation={() => {
                markLifeHubSectionDirty('community')
              }}
            />
          </>
        )}
      </View>
    </View>
  )
}
