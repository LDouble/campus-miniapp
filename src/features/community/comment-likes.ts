import type { ApiError } from '../../api/client'
import type { CommentView, ReactionState } from '../../api/types'

type CommentLikeError = Pick<ApiError, 'code' | 'message' | 'statusCode'>

export type CommentLikeFailure = {
  message: string
  refresh: boolean
}

const nextLikeActions = (
  actions: CommentView['available_actions'],
  liked: boolean,
) => {
  let replaced = false
  const nextAction: CommentView['available_actions'][number] = liked ? 'unlike' : 'like'
  const next = actions.reduce<CommentView['available_actions']>((result, action) => {
    if (action !== 'like' && action !== 'unlike') {
      result.push(action)
      return result
    }
    if (!replaced) result.push(nextAction)
    replaced = true
    return result
  }, [])

  return replaced ? next : actions
}

const applyReactionToComment = (
  comment: CommentView,
  reaction: ReactionState,
): CommentView => {
  const replyPreview = applyCommentReaction(comment.reply_preview, reaction)
  if (comment.id !== reaction.resource_id && replyPreview === comment.reply_preview) return comment

  return {
    ...comment,
    ...(comment.id === reaction.resource_id
      ? {
        available_actions: nextLikeActions(comment.available_actions, reaction.liked),
        like_count: reaction.like_count,
        liked: reaction.liked,
      }
      : {}),
    reply_preview: replyPreview,
  }
}

export const applyCommentReaction = (
  comments: CommentView[],
  reaction: ReactionState,
) => {
  if (reaction.resource_type !== 'comment') return comments

  let changed = false
  const next = comments.map((comment) => {
    const updated = applyReactionToComment(comment, reaction)
    if (updated !== comment) changed = true
    return updated
  })
  return changed ? next : comments
}

export const commentLikeFailure = (
  error: CommentLikeError | null,
): CommentLikeFailure => {
  if (!error) return { message: '点赞操作失败，请稍后重试', refresh: false }
  if (error.code === 'cannot_like_own_comment') {
    return { message: '不能点赞自己的评论', refresh: false }
  }
  if (error.statusCode === 404) {
    return { message: '评论已不可见，已为你刷新', refresh: true }
  }
  if (error.statusCode === 409) {
    return { message: '评论状态已变化，已为你刷新', refresh: true }
  }
  return { message: error.message, refresh: false }
}
