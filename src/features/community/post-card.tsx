import Taro from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import type { CampusCirclePostView } from '../../api/types'
import { formatDateTime } from '../life-services/format'

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
  onToggleLike: (post: CampusCirclePostView) => void
  onOpen: (post: CampusCirclePostView) => void
}

export default function CommunityPostCard({
  post,
  sectionName,
  onToggleLike,
  onOpen,
}: Props) {
  const avatarTone = post.section_id % 4
  const visibleImages = post.images.slice(0, 3)
  const remainingImages = Math.max(0, post.images.length - visibleImages.length)
  const authorCode = String(post.author_id).padStart(2, '0').slice(-2)
  const publishedAt = formatDateTime(post.published_at || post.created_at)

  return (
    <View
      id={`community-post-${post.id}`}
      className='community-post api-post'
    >
      <View
        className='community-post__header'
        hoverClass='community-post__tap-area--pressed'
        hoverStartTime={20}
        hoverStayTime={120}
        ariaRole='button'
        ariaLabel={`查看校园同学 ${post.author_id} 发布的动态`}
        onClick={() => onOpen(post)}
      >
        <View className={`community-post__avatar community-post__avatar--tone-${avatarTone}`}>
          <Text>{authorCode}</Text>
        </View>
        <View className='community-post__author'>
          <View className='community-post__author-line'>
            <Text>校园同学</Text>
            <Text>校园号 {post.author_id}</Text>
          </View>
          <View className='community-post__meta'>
            <Text>{publishedAt}</Text>
            <View className='community-post__meta-divider' />
            <Image src={communityIcons.topic} mode='aspectFit' />
            <Text className='community-post__section-name'>{sectionName}</Text>
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
        {post.content && <Text className='community-post__content'>{post.content}</Text>}
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
          <Text className='community-post__action-count'>{post.comment_count}</Text>
        </View>
        <View
          className='community-post__action community-post__action--share'
          hoverClass='community-post__action--pressed'
          hoverStartTime={20}
          hoverStayTime={120}
          ariaRole='button'
          ariaLabel='分享这条动态'
          onClick={() => Taro.showShareMenu({ withShareTicket: true })}
        >
          <Image src={communityIcons.share} mode='aspectFit' />
        </View>
      </View>
    </View>
  )
}
