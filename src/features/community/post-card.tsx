import { memo, useState } from 'react'
import { Button, Image, Text, View } from '@tarojs/components'
import type { CampusCirclePostView } from '../../api/types'
import { apiDateTimeCampusParts, apiDateTimeTimestamp } from '../../utils/date-time'
import {
  communityAuthorAvatarUrl,
  communityAuthorInitial,
  communityAuthorName,
} from './author'
import UserAvatar from '../../components/user-avatar'
import StickerContent from '../../components/sticker-content'
import { parseStickerContent, plainStickerContent } from '../stickers/content'
import { orderPublicCommentPreviews } from './comments'
import ContentImageGrid from './components/content-image-grid'

const communityIcons = {
  comment: require('../../assets/community/comment.svg'),
  heart: require('../../assets/community/feed-heart.svg'),
  heartActive: require('../../assets/community/heart-active.svg'),
  more: require('../../assets/icons/more-horizontal.svg'),
  marketplace: require('../../assets/icons/market.svg'),
  errand: require('../../assets/icons/errands.svg'),
  carpool: require('../../assets/icons/shuttle.svg'),
}

const CAMPUS_OFFSET_MILLISECONDS = 8 * 60 * 60 * 1000
const DAY_MILLISECONDS = 24 * 60 * 60 * 1000
const MAX_POST_IMAGES = 9

const formatCommunityPostTime = (value?: string | null, now = Date.now()) => {
  const timestamp = apiDateTimeTimestamp(value)
  const parts = apiDateTimeCampusParts(value)
  if (!Number.isFinite(timestamp) || !parts) return '时间待确认'

  const elapsed = Math.max(0, now - timestamp)
  const dayIndex = Math.floor((timestamp + CAMPUS_OFFSET_MILLISECONDS) / DAY_MILLISECONDS)
  const currentDayIndex = Math.floor((now + CAMPUS_OFFSET_MILLISECONDS) / DAY_MILLISECONDS)
  const dayDifference = currentDayIndex - dayIndex

  if (dayDifference === 0) {
    const minutes = Math.floor(elapsed / 60_000)
    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    return `${Math.floor(minutes / 60)}小时前`
  }
  if (dayDifference === 1) return `昨天 ${parts.time}`
  if (dayDifference > 1 && dayDifference < 7) return `${dayDifference}天前`

  const currentParts = apiDateTimeCampusParts(new Date(now).toISOString())
  return currentParts?.year === parts.year
    ? `${parts.month}月${parts.day}日`
    : `${parts.year}年${parts.month}月${parts.day}日`
}

type Props = {
  post: CampusCirclePostView
  sectionName: string
  motionDelay?: number
  timeFormatter?: (value?: string | null) => string
  onToggleLike?: (post: CampusCirclePostView) => void | Promise<void>
  onOpen: (post: CampusCirclePostView) => void
  onOpenComments: (post: CampusCirclePostView) => void
  actionsOpen: boolean
  onToggleActions: (postId: number) => void
  onCloseActions: () => void
  onOpenAuthor?: (post: CampusCirclePostView) => void
  onSelectSection?: (sectionId: number) => void
  variant?: 'community' | 'marketplace' | 'errand' | 'carpool'
  instanceKey?: string
  businessPreview?: { title: string; meta: string }
  onReplyComment?: (post: CampusCirclePostView, comment: CommunityPostCommentPreview) => void
}

export type CommunityPostCommentPreview = {
  id: number
  authorId: number
  authorDeleted: boolean
  authorNickname: string
  content: string
  rootId: number
  parentId: number | null
  replyToCommentId: number | null
  replyToNickname: string | null
}

function CommunityPostCard({
  post,
  sectionName,
  motionDelay = 0,
  timeFormatter,
  onToggleLike,
  onOpen,
  onOpenComments,
  actionsOpen,
  onToggleActions,
  onCloseActions,
  onOpenAuthor,
  onSelectSection,
  variant = 'community',
  instanceKey,
  businessPreview,
  onReplyComment,
}: Props) {
  const [likePending, setLikePending] = useState(false)
  const authorName = communityAuthorName(post)
  const cardId = instanceKey || String(post.id)
  const authorInitial = communityAuthorInitial(post)
  const authorAvatarUrl = communityAuthorAvatarUrl(post)
  const visibleImages = post.images.slice(0, MAX_POST_IMAGES)
  const publishedAt = (timeFormatter || formatCommunityPostTime)(
    post.published_at || post.created_at,
  )
  const reviewStatus = post.viewer_relation === 'owner'
    ? post.status === 'pending_review'
      ? { label: '审核中', tone: 'pending' }
      : post.status === 'rejected'
        ? { label: '未通过', tone: 'rejected' }
        : null
    : null

  const imagesPendingReview = post.viewer_relation === 'owner'
    && post.status === 'pending_review'
  const readableContent = plainStickerContent(post.content || '')
  const contentParts = parseStickerContent(post.content || '')
  const contentIsClamped = readableContent.length > 90
  const operationBadges = [
    post.is_pinned && '置顶',
    post.is_featured && '精选',
    post.is_recommended && '推荐',
    post.topic?.kind === 'campaign' && '活动',
  ].filter(Boolean) as string[]
  const onlyStickers = contentParts.length > 0 && contentParts.every((part) => (
    part.type === 'sticker' || part.text.trim().length === 0
  ))
  const compactContent = Boolean(post.content)
    && visibleImages.length === 0
    && !businessPreview
    && operationBadges.length === 0
    && (onlyStickers || readableContent.trim().length <= 20)
  const openAuthorOrPost = () => (
    !post.author_deleted && onOpenAuthor ? onOpenAuthor(post) : onOpen(post)
  )
  const orderedCommentPreviews = orderPublicCommentPreviews(post.comment_previews)
  const visibleRootIds = new Set(
    orderedCommentPreviews.filter((comment) => !comment.parent_id).map((comment) => comment.id),
  )
  const commentPreviews = orderedCommentPreviews.map((comment) => ({
    id: comment.id,
    authorId: comment.author_id,
    authorDeleted: false,
    authorNickname: comment.author_nickname,
    content: comment.content,
    rootId: comment.root_id,
    parentId: comment.parent_id,
    replyToCommentId: comment.reply_to_comment_id,
    replyToNickname: comment.reply_to_nickname,
    nested: Boolean(comment.parent_id && visibleRootIds.has(comment.root_id)),
  }))
  const likedByCopy = onToggleLike && post.liked_by_nicknames.length > 0
    ? post.like_count > post.liked_by_nicknames.length
      ? `${post.liked_by_nicknames.join('、')} 等 ${post.like_count} 人`
      : post.liked_by_nicknames.join('、')
    : onToggleLike && post.like_count > 0 ? `${post.like_count} 位同学` : ''

  return (
    <View
      id={`community-post-${cardId}`}
      className={[
        'community-post',
        'api-post',
        `community-post--${variant}`,
        compactContent ? 'community-post--compact-content' : '',
        actionsOpen ? 'community-post--actions-open' : '',
        motionDelay > 0 ? 'motion-enter' : '',
        motionDelay > 0 ? `motion-enter--delay-${Math.min(motionDelay, 4)}` : '',
      ].filter(Boolean).join(' ')}
      ariaRole='button'
      ariaLabel={`查看动态：${readableContent || '校园图片动态'}`}
      onClick={() => onOpen(post)}
    >
      <View
        className='community-post__avatar-button'
        ariaRole='button'
        ariaLabel={onOpenAuthor && !post.author_deleted
          ? `查看${authorName}的个人主页`
          : `查看${authorName}发布的动态`}
        onClick={(event) => {
          event.stopPropagation()
          openAuthorOrPost()
        }}
      >
        <UserAvatar
          src={authorAvatarUrl}
          className='community-post__avatar'
          imageClassName='community-post__avatar-image'
          fallback={authorInitial}
          userId={post.author_deleted ? 0 : post.author_id}
          lazyLoad
        />
      </View>

      <View className='community-post__main'>
        <View
          className='community-post__author'
          ariaRole='button'
          ariaLabel={onOpenAuthor && !post.author_deleted
            ? `查看${authorName}的个人主页`
            : `查看${authorName}发布的动态`}
          onClick={(event) => {
            event.stopPropagation()
            openAuthorOrPost()
          }}
        >
          <View className={post.author_deleted
            ? 'community-post__author-line community-post__author-line--deleted'
            : 'community-post__author-line'}
          >
            <Text>{authorName}</Text>
          </View>
        </View>

        <View
          className='community-post__body api-post__body'
        >
          {operationBadges.length > 0 && (
            <View className='community-post__badges'>
              {operationBadges.map((badge) => <Text key={badge}>{badge}</Text>)}
            </View>
          )}
          {post.content && (
            <View className={contentIsClamped
              ? 'community-post__content-wrap community-post__content-wrap--clamped'
              : 'community-post__content-wrap'}
            >
              <StickerContent
                content={post.content}
                className='community-post__content'
                stickerClassName='community-post__content-sticker'
              />
              {contentIsClamped && <Text className='community-post__expand'>全文</Text>}
            </View>
          )}
          {businessPreview && variant !== 'community' && (
            <View className={`community-post__business-preview community-post__business-preview--${variant}`}>
              <View className='community-post__business-icon'>
                <Image src={communityIcons[variant]} mode='aspectFit' />
              </View>
              <View className='community-post__business-copy'>
                <Text className='community-post__business-title'>{businessPreview.title}</Text>
                <Text className='community-post__business-meta'>{businessPreview.meta}</Text>
              </View>
            </View>
          )}
          {visibleImages.length > 0 && (
            <ContentImageGrid
              images={visibleImages}
              pendingReview={imagesPendingReview}
            />
          )}
        </View>

        <View className='community-post__meta'>
          <View className='community-post__meta-copy'>
            <Text className='community-post__time'>{publishedAt}</Text>
            {reviewStatus && (
              <Text className={`community-post__review-status community-post__review-status--${reviewStatus.tone}`}>
                {reviewStatus.label}
              </Text>
            )}
            {sectionName && (onSelectSection ? (
              <View
                className='community-post__section-pill'
                ariaRole='button'
                ariaLabel={`筛选${sectionName}板块`}
                onClick={(event) => {
                  event.stopPropagation()
                  onSelectSection(post.section_id)
                }}
              >
                <Text> · {sectionName}</Text>
              </View>
            ) : (
              <Text className='community-post__section-label'> · {sectionName}</Text>
            ))}
          </View>
          <View className='community-post__meta-actions'>
            <Button
              id={`community-post-more-${cardId}`}
              className='community-post__more'
              hoverClass='none'
              ariaLabel={actionsOpen ? '收起动态操作' : '展开动态操作'}
              onTouchStart={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                onToggleActions(post.id)
              }}
            >
              <Image src={communityIcons.more} mode='aspectFit' />
            </Button>
            {actionsOpen && (
              <View
                className={[
                  'community-post__social',
                  'community-post__action-menu',
                  !onToggleLike
                    ? 'community-post__action-menu--single'
                    : post.liked ? 'community-post__action-menu--liked' : '',
                ].filter(Boolean).join(' ')}
                onClick={(event) => event.stopPropagation()}
              >
                {onToggleLike && (
                  <>
                    <View
                      className={post.liked
                        ? 'community-post__social-like community-post__social-like--liked'
                        : 'community-post__social-like'}
                      ariaRole='button'
                      ariaLabel={likePending
                        ? '点赞处理中'
                        : `${post.liked ? '取消点赞' : '点赞'}，当前 ${post.like_count} 个赞`}
                      onClick={(event) => {
                        event.stopPropagation()
                        if (likePending) return
                        setLikePending(true)
                        onCloseActions()
                        void Promise.resolve(onToggleLike(post))
                          .catch(() => undefined)
                          .finally(() => setLikePending(false))
                      }}
                    >
                      <Image src={post.liked ? communityIcons.heartActive : communityIcons.heart} mode='aspectFit' />
                      <Text>{likePending ? '处理中…' : post.liked ? '取消点赞' : '点赞'}</Text>
                    </View>
                    <View className='community-post__social-divider' />
                  </>
                )}
                <View
                  className='community-post__comments-summary'
                  ariaRole='button'
                  ariaLabel='打开评论输入'
                  onClick={(event) => {
                    event.stopPropagation()
                    onCloseActions()
                    onOpenComments(post)
                  }}
                >
                  <Image src={communityIcons.comment} mode='aspectFit' />
                  <Text>评论</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {(likedByCopy || commentPreviews.length > 0 || post.comment_count > 3) && (
          <View className='community-post__engagement'>
            {likedByCopy && (
              <View className='community-post__liked-by'>
                <Image src={communityIcons.heart} mode='aspectFit' />
                <Text>{likedByCopy}</Text>
              </View>
            )}
            {(commentPreviews.length > 0 || post.comment_count > 3) && (
              <View className='community-post__comment-previews'>
                {commentPreviews.map((comment) => (
                  <View
                    key={comment.id}
                    id={`community-comment-preview-${comment.id}`}
                    className={comment.nested
                      ? 'community-post__comment-preview community-post__comment-preview--reply'
                      : 'community-post__comment-preview'}
                    ariaRole={onReplyComment ? 'button' : undefined}
                    ariaLabel={comment.parentId && comment.replyToNickname
                      ? `${comment.authorNickname}回复${comment.replyToNickname}：${plainStickerContent(comment.content)}`
                      : `${comment.authorNickname}的评论：${plainStickerContent(comment.content)}`}
                    onClick={onReplyComment ? (event) => {
                      event.stopPropagation()
                      onReplyComment(post, comment)
                    } : undefined}
                  >
                    <Text className='community-post__comment-preview-author'>
                      {comment.authorDeleted ? '已注销用户' : comment.authorNickname}
                    </Text>
                    {comment.parentId && comment.replyToNickname && (
                      <>
                        <Text className='community-post__comment-preview-relation'> 回复 </Text>
                        <Text className='community-post__comment-preview-author'>
                          {comment.replyToNickname}
                        </Text>
                      </>
                    )}
                    <Text>：</Text>
                    <StickerContent
                      content={comment.content}
                      className='community-post__comment-preview-content'
                      stickerClassName='community-post__comment-preview-sticker'
                    />
                  </View>
                ))}
                {post.comment_count > 3 && (
                  <View
                    className='community-post__comments-all'
                    ariaRole='button'
                    ariaLabel={`查看全部 ${post.comment_count} 条评论`}
                    onClick={(event) => {
                      event.stopPropagation()
                      onOpen(post)
                    }}
                  >
                    查看全部 {post.comment_count} 条评论
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  )
}

export { formatCommunityPostTime }
export default memo(CommunityPostCard)
