import { useState } from 'react'
import Taro, {
  useLoad,
  usePullDownRefresh,
} from '@tarojs/taro'
import { Button, Image, Text, View } from '@tarojs/components'
import type { CampusCirclePostView } from '../../api/types'
import { isApiError } from '../../api/client'
import CustomNavbar from '../../components/custom-navbar'
import UserAvatarImage from '../../components/user-avatar-image'
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
import CommunityLevelBadge from '../../features/community/level-badge'
import DetailAuthorNavbar from '../../features/life-services/components/detail-author-navbar'
import DetailComments from '../../features/life-services/components/detail-comments'
import { buildDetailFooterActions } from '../../features/life-services/detail-actions'
import { useCampusShare } from '../../features/share'
import { openPublicProfile } from '../../features/profile/public-profile'
import './detail.scss'

const communityDetailIcons = {
  comment: require('../../assets/community/comment.svg'),
  heart: require('../../assets/community/heart.svg'),
  heartActive: require('../../assets/community/heart-active.svg'),
  share: require('../../assets/community/share.svg'),
}

const actionLabels: Record<string, string> = {
  edit: '编辑动态',
  withdraw: '删除动态',
}

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
    void Taro.pageScrollTo({ selector: '.business-detail-comments', duration: 180 })
  }

  const footerActions = post ? buildDetailFooterActions({
    availableActions: post.available_actions,
    labels: actionLabels,
    priority: ['edit', 'withdraw'],
    dangerActions: ['withdraw'],
    busy: deletingPost,
    onAction: (action) => action === 'edit' ? editPost() : void deletePost(),
  }) : []

  return (
    <View className='community-detail'>
      <CustomNavbar
        title='动态详情'
        showBack
        barContent={post ? (
          <DetailAuthorNavbar
            avatarUrl={post.author_avatar_url}
            nickname={communityAuthorName(post)}
            userId={post.author_id}
          />
        ) : undefined}
      />
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
              <View
                className='community-detail-card__top'
                hoverClass='community-detail-card__top--pressed'
                ariaRole='button'
                ariaLabel={`查看${communityAuthorName(post)}的个人主页`}
                onClick={() => {
                  if (!post.author_deleted) void openPublicProfile(post.author_id)
                }}
              >
                <View
                  className={`community-detail-card__avatar community-detail-card__avatar--tone-${communityAuthorTone(post)}`}
                >
                  <UserAvatarImage
                    src={communityAuthorAvatarUrl(post)}
                    className='community-detail-card__avatar-image'
                    fallback={communityAuthorInitial(post)}
                    lazyLoad
                  />
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
              {post.topic?.name && (
                <View className='community-detail-card__toolbar'>
                  <View className='community-detail-card__tags'>
                    <Text>#{post.topic.name}</Text>
                  </View>
                </View>
              )}
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

            <DetailComments
              targetType='campus_circle_post'
              targetId={post.id}
              enabled={post.status === 'approved'}
              targetAuthorId={post.author_id}
              initialCommentId={focusedCommentId}
              displayTotal={post.comment_count}
              placeholder='友善交流，分享你的想法'
              tone='community'
              actions={footerActions}
              quickAction={{
                active: post.liked,
                activeIcon: communityDetailIcons.heartActive,
                icon: communityDetailIcons.heart,
                label: post.liked ? '取消点赞' : '点赞',
                onClick: () => void toggleLike(),
              }}
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
