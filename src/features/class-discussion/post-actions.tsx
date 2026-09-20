import { Button, Image, Text, View } from '@tarojs/components'
import type { CampusCirclePostView } from '../../api/types'
import FavoriteToggle from '../favorites/favorite-toggle'

const icons = {
  comment: require('../../assets/community/comment.svg'),
  heart: require('../../assets/community/feed-heart.svg'),
  heartActive: require('../../assets/community/heart-active.svg'),
  share: require('../../assets/community/share.svg'),
}

type Props = {
  post: CampusCirclePostView
  sectionName: string
  shareTitle: string
  onToggleLike?: (post: CampusCirclePostView) => void | Promise<void>
  onOpenComments?: (post: CampusCirclePostView) => void
}

/** 课堂讨论独有的四项操作，避免影响通用社区帖子卡。 */
export default function ClassDiscussionPostActions({
  post,
  sectionName,
  shareTitle,
  onToggleLike,
  onOpenComments,
}: Props) {
  return (
    <View className='community-post__classroom-actions' onClick={(event) => event.stopPropagation()}>
      <View
        className={post.liked
          ? 'community-post__classroom-action community-post__classroom-action--liked'
          : 'community-post__classroom-action'}
        ariaRole='button'
        ariaLabel={`${post.liked ? '取消点赞' : '点赞'}，当前 ${post.like_count} 个赞`}
        onClick={(event) => {
          event.stopPropagation()
          void onToggleLike?.(post)
        }}
      >
        <Image src={post.liked ? icons.heartActive : icons.heart} mode='aspectFit' />
        <Text>{post.like_count || '点赞'}</Text>
      </View>
      <View
        className='community-post__classroom-action'
        ariaRole='button'
        ariaLabel={`评论，当前 ${post.comment_count} 条评论`}
        onClick={(event) => {
          event.stopPropagation()
          onOpenComments?.(post)
        }}
      >
        <Image src={icons.comment} mode='aspectFit' />
        <Text>{post.comment_count || '评论'}</Text>
      </View>
      <FavoriteToggle resourceId={post.id} resourceType='campus_circle_post' />
      <Button
        className='community-post__classroom-action community-post__classroom-share'
        hoverClass='none'
        openType='share'
        data-post-id={post.id}
        data-share-title={shareTitle || `${sectionName}讨论`}
        onClick={(event) => event.stopPropagation()}
      >
        <Image src={icons.share} mode='aspectFit' />
        <Text>分享</Text>
      </Button>
    </View>
  )
}
