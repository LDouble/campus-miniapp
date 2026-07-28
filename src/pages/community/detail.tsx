import { useState } from 'react'
import Taro, {
  useLoad,
  usePullDownRefresh,
  useShareAppMessage,
} from '@tarojs/taro'
import { Button, Image, Input, Text, View } from '@tarojs/components'
import type {
  CampusCirclePostView,
  CommentView,
} from '../../api/types'
import { isApiError } from '../../api/client'
import CustomNavbar from '../../components/custom-navbar'
import { formatDateTime, formatStatus } from '../../features/life-services/format'
import { lifeServicesRepository } from '../../features/life-services/repository'
import './detail.scss'

const communityDetailIcons = {
  comment: require('../../assets/community/comment.svg'),
  edit: require('../../assets/community/edit.svg'),
  heart: require('../../assets/community/heart.svg'),
  heartActive: require('../../assets/community/heart-active.svg'),
  send: require('../../assets/community/send.svg'),
  share: require('../../assets/community/share.svg'),
}

const getIdentityCode = (id: number) => String(id).padStart(2, '0').slice(-2)
const getIdentityTone = (id: number) => Math.abs(id) % 4

export default function CommunityDetailPage() {
  const [postId, setPostId] = useState(0)
  const [post, setPost] = useState<CampusCirclePostView | null>(null)
  const [comments, setComments] = useState<CommentView[]>([])
  const [commentPage, setCommentPage] = useState(1)
  const [commentTotal, setCommentTotal] = useState(0)
  const [loadingMoreComments, setLoadingMoreComments] = useState(false)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const load = async (id: number) => {
    setLoading(true)
    setError('')
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
        setComments(commentResult.items)
        setCommentPage(commentResult.page)
        setCommentTotal(Number(commentResult.total))
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
    if (!Number.isFinite(id) || id <= 0) {
      setLoading(false)
      setError('动态地址无效')
      return
    }
    setPostId(id)
    void load(id)
  })

  usePullDownRefresh(() => {
    if (postId) void load(postId)
    else Taro.stopPullDownRefresh()
  })

  useShareAppMessage(() => ({
    title: post?.content?.trim().slice(0, 28) || '海大校园动态',
    path: `/pages/community/detail?id=${postId}&mode=post`,
    imageUrl: post?.images[0]?.url,
  }))

  const toggleLike = async () => {
    if (!post) return
    try {
      const result = post.liked
        ? await lifeServicesRepository.unlikeCampusCirclePost(post.id)
        : await lifeServicesRepository.likeCampusCirclePost(post.id)
      setPost(result)
    } catch (actionError) {
      if (isApiError(actionError) && actionError.code === 'academic_verification_required') return
      Taro.showToast({
        title: isApiError(actionError) ? actionError.message : '操作失败',
        icon: 'none',
      })
    }
  }

  const submitComment = async () => {
    const value = comment.trim()
    if (!value || !post || post.status !== 'approved' || submitting) {
      if (!value) Taro.showToast({ title: '请输入评论内容', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      const created = await lifeServicesRepository.createComment({
        target_type: 'campus_circle_post',
        target_id: post.id,
        content: value,
      })
      setComments((current) => current.some((item) => item.id === created.id)
        ? current
        : [...current, created])
      setCommentTotal((current) => current + 1)
      if (created.status === 'approved') {
        setPost((current) => current
          ? { ...current, comment_count: current.comment_count + 1 }
          : current)
      }
      setComment('')
      Taro.showToast({
        title: created.status === 'approved' ? '评论已发布' : '评论已提交审核',
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
    Taro.navigateTo({
      url: `/pages/publish/index?section=community&mode=edit&id=${post.id}`,
    })
  }

  const previewPostImage = (current: string) => {
    if (!post || post.images.length === 0) return
    void Taro.previewImage({
      current,
      urls: post.images.map((image) => image.url),
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
      setComments((current) => {
        const byId = new Map(current.map((item) => [item.id, item]))
        result.items.forEach((item) => byId.set(item.id, item))
        return [...byId.values()]
      })
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
                  className={`community-detail-card__avatar community-detail-card__avatar--tone-${getIdentityTone(post.section_id)}`}
                >
                  {getIdentityCode(post.author_id)}
                </View>
                <View className='community-detail-card__author'>
                  <View>
                    <Text>校园同学</Text>
                    <Text>校园号 {post.author_id}</Text>
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
                    <Image
                      key={image.id}
                      src={image.url}
                      mode='widthFix'
                      lazyLoad
                      onClick={() => previewPostImage(image.url)}
                    />
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
              {comments.map((item) => (
                <View
                  id={`community-comment-${item.id}`}
                  key={item.id}
                  className={`community-detail-comments__item community-comment community-comment--${item.status}`}
                >
                  <View
                    className={`community-detail-comments__avatar community-detail-comments__avatar--tone-${getIdentityTone(item.author_id)}`}
                  >
                    {getIdentityCode(item.author_id)}
                  </View>
                  <View className='community-detail-comments__copy'>
                    <View className='community-detail-comments__author'>
                      <Text>校园同学</Text>
                      <Text>校园号 {item.author_id}</Text>
                    </View>
                    <Text className='community-comment__content'>{item.content}</Text>
                    <View className='community-detail-comments__meta'>
                      <Text>{formatDateTime(item.created_at)}</Text>
                      {item.status !== 'approved' && (
                        <>
                          <View />
                          <Text>{formatStatus(item.status)}</Text>
                        </>
                      )}
                    </View>
                  </View>
                </View>
              ))}
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
              <View className='community-detail-comments__composer'>
                <Input
                  id='community-comment-input'
                  value={comment}
                  disabled={submitting}
                  maxlength={300}
                  confirmType='send'
                  cursorSpacing={18}
                  placeholder='友善交流，分享你的想法'
                  placeholderClass='community-detail-comments__placeholder'
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
                  ariaLabel={submitting ? '评论发送中' : '发送评论'}
                  onClick={() => void submitComment()}
                >
                  <Image src={communityDetailIcons.send} mode='aspectFit' />
                </View>
              </View>
            )}
          </>
        )}
      </View>
    </View>
  )
}
