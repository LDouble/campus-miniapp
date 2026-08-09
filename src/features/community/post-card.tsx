import { Button, Image, Text, View } from '@tarojs/components'
import type { CampusCirclePostView } from '../../api/types'
import { formatDateTime } from '../life-services/format'
import {
  communityAuthorInitial,
  communityAuthorName,
  communityAuthorTone,
} from './author'
import CommunityLevelBadge from './level-badge'

const communityIcons = {
  comment: require('../../assets/community/comment.svg'),
  heart: require('../../assets/community/heart.svg'),
  heartActive: require('../../assets/community/heart-active.svg'),
  share: require('../../assets/community/share.svg'),
  topic: require('../../assets/community/topic.svg'),
}

type Props = {
  post: CampusCirclePostView
  sectionName: string
  motionDelay?: number
  onToggleLike: (post: CampusCirclePostView) => void
  onOpen: (post: CampusCirclePostView) => void
}

export default function CommunityPostCard({
  post,
  sectionName,
  motionDelay = 0,
  onToggleLike,
  onOpen,
}: Props) {
  const authorName = communityAuthorName(post)
  const authorInitial = communityAuthorInitial(post)
  const avatarTone = communityAuthorTone(post)
  const visibleImages = post.images.slice(0, 3)
  const remainingImages = Math.max(0, post.images.length - visibleImages.length)
  const publishedAt = formatDateTime(post.published_at || post.created_at)

  return (
    <View
      id={`community-post-${post.id}`}
      className={[
        'community-post',
        'api-post',
        'motion-enter',
        motionDelay > 0 ? `motion-enter--delay-${Math.min(motionDelay, 4)}` : '',
      ].filter(Boolean).join(' ')}
    >
      <View
        className='community-post__header'
        hoverClass='community-post__tap-area--pressed'
        hoverStartTime={20}
        hoverStayTime={120}
        ariaRole='button'
        ariaLabel={`查看${authorName}发布的动态`}
        onClick={() => onOpen(post)}
      >
        <View className={`community-post__avatar community-post__avatar--tone-${avatarTone}`}>
          <Text>{authorInitial}</Text>
        </View>
        <View className='community-post__author'>
          <View className='community-post__author-line'>
            <Text>{authorName}</Text>
            <CommunityLevelBadge level={post.author_level} compact />
          </View>
          <View className='community-post__meta'>
            <Text>{publishedAt}</Text>
          </View>
        </View>
      </View>

      <View
        className='community-post__body api-post__body'
        hoverClass='community-post__tap-area--pressed'
        hoverStartTime={20}
        hoverStayTime={120}
        ariaRole='button'
        ariaLabel={`查看动态：${post.content || '校园图片动态'}`}
        onClick={() => onOpen(post)}
      >
        <View className='community-post__section-pill'>
          <Image src={communityIcons.topic} mode='aspectFit' />
          <Text>{sectionName}</Text>
        </View>
        {post.content && <Text className='community-post__content'>{post.content}</Text>}
        {post.content && post.content.length > 90 && (
          <Text className='community-post__expand'>展开全文</Text>
        )}
        {visibleImages.length > 0 && (
          <View className={`community-post__images community-post__images--${visibleImages.length}`}>
            {visibleImages.map((image, index) => (
              <View key={image.id} className='community-post__image-frame'>
                <Image src={image.url} mode='aspectFill' lazyLoad />
                {index === 2 && remainingImages > 0 && (
                  <View className='community-post__image-more'>
                    <Text>+{remainingImages}</Text>
                    <Text>更多图片</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      <View className='community-post__actions'>
        <View
          className={post.liked ? 'community-post__action community-post__action--liked' : 'community-post__action'}
          hoverClass='community-post__action--pressed'
          hoverStartTime={20}
          hoverStayTime={120}
          ariaRole='button'
          ariaLabel={`${post.liked ? '取消点赞' : '点赞'}，当前 ${post.like_count} 个赞`}
          onClick={() => onToggleLike(post)}
        >
          <Image src={post.liked ? communityIcons.heartActive : communityIcons.heart} mode='aspectFit' />
          <Text className='community-post__action-label'>
            {post.liked ? '已赞' : '点赞'}
          </Text>
          <Text className='community-post__action-count'>{post.like_count}</Text>
        </View>
        <View
          className='community-post__action'
          hoverClass='community-post__action--pressed'
          hoverStartTime={20}
          hoverStayTime={120}
          ariaRole='button'
          ariaLabel={`查看评论，当前 ${post.comment_count} 条评论`}
          onClick={() => onOpen(post)}
        >
          <Image src={communityIcons.comment} mode='aspectFit' />
          <Text className='community-post__action-label'>评论</Text>
          <Text className='community-post__action-count'>{post.comment_count}</Text>
        </View>
        <Button
          className='community-post__action community-post__action--share'
          openType='share'
          data-post-id={post.id}
          data-share-title={(post.content || '海大校园动态').trim().slice(0, 28)}
          data-share-image={post.images[0]?.url || ''}
          hoverClass='community-post__action--pressed'
          ariaLabel='分享这条动态'
        >
          <Image src={communityIcons.share} mode='aspectFit' />
          <Text className='community-post__action-label'>分享</Text>
        </Button>
      </View>
    </View>
  )
}
