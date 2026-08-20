import { useState } from 'react'
import Taro, {
  useLoad,
  usePullDownRefresh,
} from '@tarojs/taro'
import { Button, Image, Text, View } from '@tarojs/components'
import type { CampusCirclePostView } from '../../../api/types'
import { isApiError } from '../../../api/client'
import CustomNavbar from '../../../components/custom-navbar'
import StickerContent from '../../../components/sticker-content'
import UserAvatar from '../../../components/user-avatar'
import {
  communityAuthorAvatarUrl,
  communityAuthorInitial,
  communityAuthorName,
} from '../../../features/community/author'
import { consumeCommunityDetailSnapshot } from '../../../features/community/detail-snapshot'
import CommunityLevelBadge from '../../../features/community/level-badge'
import { openContentReport } from '../../../features/content-report'
import DetailComments from '../../../features/life-services/components/detail-comments'
import { buildDetailFooterActions } from '../../../features/life-services/detail-actions'
import { formatDateTime, formatStatus } from '../../../features/life-services/format'
import { markLifeHubSectionDirty } from '../../../features/life-services/refresh-policy'
import { lifeServicesRepository } from '../../../features/life-services/repository'
import { openPublicProfile } from '../../../features/profile/public-profile'
import { useCampusShare } from '../../../features/share'
import { plainStickerContent } from '../../../features/stickers/content'
import { requestWechatSubscriptionForModule } from '../../../features/wechat-subscription'
import { showActionSheetSelection } from '../../../utils/action-sheet'
import './detail.scss'

const communityDetailIcons = {
  comment: require('../../../assets/community/comment.svg'),
  heart: require('../../../assets/community/feed-heart.svg'),
  heartActive: require('../../../assets/community/heart-active.svg'),
  more: require('../../../assets/community/detail-more.svg'),
  share: require('../../../assets/community/detail-share.svg'),
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
    title: plainStickerContent(post?.content || '').trim().slice(0, 28) || '海大校园动态',
    path: '/packages/social/community/detail',
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
      url: `/packages/social/publish/index?section=community&mode=edit&id=${post.id}`,
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

  const previewPostImage = (current: string) => {
    if (!post || !current) return
    const urls = post.images.map((image) => image.url).filter(Boolean)
    if (urls.length === 0) return
    void Taro.previewImage({
      current,
      urls,
    })
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
              <View className='community-detail__author'>
                <View
                  className='community-detail__author-trigger'
                  hoverClass='community-detail__author-trigger--pressed'
                  ariaRole='button'
                  ariaLabel={`查看${communityAuthorName(post)}的个人主页`}
                  onClick={() => {
                    if (!post.author_deleted) void openPublicProfile(post.author_id)
                  }}
                >
                  <UserAvatar
                    src={communityAuthorAvatarUrl(post)}
                    className='community-detail__avatar'
                    imageClassName='community-detail-card__avatar-image'
                    fallback={communityAuthorInitial(post)}
                    userId={post.author_deleted ? 0 : post.author_id}
                  />
                  <View className='community-detail__author-copy'>
                    <View className='community-detail__author-name-row'>
                      <Text className='community-detail__author-name'>{communityAuthorName(post)}</Text>
                      <CommunityLevelBadge level={post.author_level} />
                    </View>
                    <View className='community-detail__author-meta'>
                      <Text>{formatDetailDateTime(post.published_at || post.created_at)}</Text>
                      {post.status !== 'approved' && (
                        <Text className='community-detail__status'>{formatStatus(post.status)}</Text>
                      )}
                    </View>
                  </View>
                </View>
                {postMenuItems.length > 0 && (
                  <View
                    id='community-detail-more'
                    className='community-detail__more'
                    hoverClass='community-detail__more--pressed'
                    ariaRole='button'
                    ariaLabel='更多帖子操作'
                    onClick={() => void openPostMenu()}
                  >
                    <Image src={communityDetailIcons.more} mode='aspectFit' />
                  </View>
                )}
              </View>

              {post.topic?.name && (
                <View className='community-detail__topic'>#{post.topic.name}</View>
              )}

              {post.content && (
                <StickerContent
                  content={post.content}
                  className='community-detail__body community-detail-card__body'
                  stickerClassName='community-detail__body-sticker'
                />
              )}

              {post.images.length > 0 && (
                <View className={post.images.length === 1
                  ? 'community-detail__images community-detail-card__images community-detail-card__images--single'
                  : 'community-detail__images community-detail-card__images'}
                >
                  {post.images.map((image, index) => (
                    <View
                      key={image.id}
                      className='community-detail__image-frame community-detail-card__image-frame'
                      ariaRole={image.url ? 'button' : undefined}
                      ariaLabel={image.url ? `预览第 ${index + 1} 张图片，共 ${post.images.length} 张` : undefined}
                      onClick={() => previewPostImage(image.url)}
                    >
                      {image.url && (
                        <Image
                          src={image.url}
                          mode={post.images.length === 1 ? 'widthFix' : 'aspectFill'}
                          lazyLoad
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

              <View className='community-detail__actions'>
                <View
                  id='community-detail-like'
                  className={post.liked
                    ? 'community-detail__action community-detail__action--liked'
                    : 'community-detail__action'}
                  hoverClass='community-detail__action--pressed'
                  ariaRole='button'
                  ariaLabel={`${post.liked ? '取消点赞' : '点赞'}，当前 ${post.like_count} 个赞`}
                  onClick={() => void toggleLike()}
                >
                  <Image src={post.liked ? communityDetailIcons.heartActive : communityDetailIcons.heart} mode='aspectFit' />
                  <Text>{post.like_count}</Text>
                </View>
                <View
                  id='community-detail-comment'
                  className='community-detail__action'
                  hoverClass='community-detail__action--pressed'
                  ariaRole='button'
                  ariaLabel={`查看评论，当前 ${post.comment_count} 条评论`}
                  onClick={scrollToComments}
                >
                  <Image src={communityDetailIcons.comment} mode='aspectFit' />
                  <Text>{post.comment_count}</Text>
                </View>
                <Button
                  id='community-detail-share'
                  className='community-detail__action community-detail__action--share'
                  openType='share'
                  hoverClass='community-detail__action--pressed'
                  ariaLabel='分享这条动态'
                >
                  <Image src={communityDetailIcons.share} mode='aspectFit' />
                  <Text>分享</Text>
                </Button>
              </View>

              {post.review_reason && (
                <View className='community-detail__review community-detail-card__review'>
                  <Text>审核说明</Text>
                  <Text>{post.review_reason}</Text>
                </View>
              )}
            </View>

            <DetailComments
              targetType='campus_circle_post'
              targetId={post.id}
              enabled={post.status === 'approved'}
              targetAuthorId={post.author_id}
              initialCommentId={focusedCommentId}
              displayTotal={post.comment_count}
              headingLabel='全部评论'
              headingCountBadge
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
