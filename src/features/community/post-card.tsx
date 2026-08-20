import { memo } from 'react'
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
import { plainStickerContent } from '../stickers/content'

const communityIcons = {
  heart: require('../../assets/community/feed-heart.svg'),
  heartActive: require('../../assets/community/heart-active.svg'),
}

const CAMPUS_OFFSET_MILLISECONDS = 8 * 60 * 60 * 1000
const DAY_MILLISECONDS = 24 * 60 * 60 * 1000
const MAX_POST_IMAGES = 3

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
  onToggleLike: (post: CampusCirclePostView) => void
  onOpen: (post: CampusCirclePostView) => void
  onOpenAuthor?: (post: CampusCirclePostView) => void
  onSelectSection?: (sectionId: number) => void
}

function CommunityPostCard({
  post,
  sectionName,
  motionDelay = 0,
  timeFormatter,
  onToggleLike,
  onOpen,
  onOpenAuthor,
  onSelectSection,
}: Props) {
  const authorName = communityAuthorName(post)
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
  const contentIsClamped = readableContent.length > 90
  const operationBadges = [
    post.is_pinned && '置顶',
    post.is_featured && '精选',
    post.is_recommended && '推荐',
    post.topic?.kind === 'campaign' && '活动',
  ].filter(Boolean) as string[]
  const shareTitle = (readableContent || '海大校园动态').trim().slice(0, 28)
  const openAuthorOrPost = () => (
    !post.author_deleted && onOpenAuthor ? onOpenAuthor(post) : onOpen(post)
  )

  return (
    <View
      id={`community-post-${post.id}`}
      className={[
        'community-post',
        'api-post',
        motionDelay > 0 ? 'motion-enter' : '',
        motionDelay > 0 ? `motion-enter--delay-${Math.min(motionDelay, 4)}` : '',
      ].filter(Boolean).join(' ')}
      hoverClass='community-post__tap-area--pressed'
    >
      <View
        className='community-post__avatar-button'
        hoverClass='community-post__tap-area--pressed'
        hoverStartTime={20}
        hoverStayTime={120}
        ariaRole='button'
        ariaLabel={onOpenAuthor && !post.author_deleted
          ? `查看${authorName}的个人主页`
          : `查看${authorName}发布的动态`}
        onClick={openAuthorOrPost}
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
          hoverClass='community-post__tap-area--pressed'
          hoverStartTime={20}
          hoverStayTime={120}
          ariaRole='button'
          ariaLabel={onOpenAuthor && !post.author_deleted
            ? `查看${authorName}的个人主页`
            : `查看${authorName}发布的动态`}
          onClick={openAuthorOrPost}
        >
          <View className='community-post__author-line'>
            <Text>{authorName}</Text>
            {reviewStatus && (
              <Text className={`community-post__review-status community-post__review-status--${reviewStatus.tone}`}>
                {reviewStatus.label}
              </Text>
            )}
          </View>
        </View>

        <View
          className='community-post__body api-post__body'
          hoverClass='community-post__tap-area--pressed'
          hoverStartTime={20}
          hoverStayTime={120}
          ariaRole='button'
          ariaLabel={`查看动态：${readableContent || '校园图片动态'}`}
          onClick={() => onOpen(post)}
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
          {visibleImages.length > 0 && (
            <View className={`community-post__images community-post__images--${visibleImages.length}`}>
              {visibleImages.map((image, index) => (
                <View key={image.id} className='community-post__image-frame'>
                  {image.url && (
                    <Image
                      src={image.url}
                      mode='aspectFill'
                      lazyLoad
                      ariaLabel={`动态图片 ${index + 1}/${post.images.length}`}
                    />
                  )}
                  {imagesPendingReview && (
                    <View className={image.url
                      ? 'community-post__image-reviewing community-post__image-reviewing--overlay'
                      : 'community-post__image-reviewing'}
                    >
                      <Text>图片审核中</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        <View className='community-post__meta'>
          <View className='community-post__meta-copy'>
            <Text className='community-post__time'>{publishedAt}</Text>
            {sectionName && (onSelectSection ? (
              <View
                className='community-post__section-pill'
                hoverClass='community-post__section-pill--pressed'
                hoverStartTime={20}
                hoverStayTime={100}
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
          <Button
            className='community-post__more'
            openType='share'
            data-post-id={post.id}
            data-share-title={shareTitle}
            data-share-image={post.images[0]?.url || ''}
            hoverClass='community-post__more--pressed'
            ariaLabel='分享这条动态'
          >
            <Text>••</Text>
          </Button>
        </View>

        <View className='community-post__social'>
          <View
            className={post.liked
              ? 'community-post__social-like community-post__social-like--liked'
              : 'community-post__social-like'}
            hoverClass='community-post__social-row--pressed'
            hoverStartTime={20}
            hoverStayTime={120}
            ariaRole='button'
            ariaLabel={`${post.liked ? '取消点赞' : '点赞'}，当前 ${post.like_count} 个赞`}
            onClick={() => onToggleLike(post)}
          >
            <Image src={post.liked ? communityIcons.heartActive : communityIcons.heart} mode='aspectFit' />
            <Text>{post.like_count > 0 ? `${post.like_count} 人赞过` : post.liked ? '已赞' : '赞'}</Text>
          </View>
          <View className='community-post__social-divider' />
          <View
            className='community-post__comments-summary'
            hoverClass='community-post__social-row--pressed'
            hoverStartTime={20}
            hoverStayTime={120}
            ariaRole='button'
            ariaLabel={`查看评论，当前 ${post.comment_count} 条评论`}
            onClick={() => onOpen(post)}
          >
            <Text>{post.comment_count > 0 ? `查看全部 ${post.comment_count} 条评论` : '查看评论'}</Text>
          </View>
        </View>
      </View>
    </View>
  )
}

export { formatCommunityPostTime }
export default memo(CommunityPostCard)
