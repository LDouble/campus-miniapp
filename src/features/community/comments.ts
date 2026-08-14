import type { CommentView } from '../../api/types'

type CommentReplyTarget = Pick<CommentView, 'id'>

type CommentReplyNode = Pick<
  CommentView,
  | 'author_id'
  | 'author_nickname'
  | 'id'
  | 'parent_id'
  | 'reply_count'
  | 'reply_to_user_id'
  | 'root_id'
>

export const buildCampusCircleCommentInput = (
  postId: number,
  content: string,
  replyTarget: CommentReplyTarget | null,
) => ({
  target_type: 'campus_circle_post' as const,
  target_id: postId,
  content: content.trim(),
  ...(replyTarget ? { parent_id: replyTarget.id } : {}),
})

export const commentRootId = (comment: Pick<CommentView, 'id' | 'root_id'>) => (
  comment.root_id || comment.id
)

export const mergeLocalThreadReply = <T extends CommentReplyNode>(
  descendants: T[],
  created: T,
) => {
  if (descendants.some((item) => item.id === created.id)) return descendants

  const next = descendants.map((item) => (
    item.id === created.parent_id
      ? { ...item, reply_count: item.reply_count + 1 }
      : item
  ))
  next.push(created)
  return next.sort((left, right) => left.id - right.id)
}

export const commentReplyTargetName = (
  comment: Pick<CommentView, 'reply_to_user_id'>,
  thread: Pick<CommentView, 'author_id' | 'author_nickname'>[],
) => {
  if (!comment.reply_to_user_id) return ''
  return thread.find((item) => item.author_id === comment.reply_to_user_id)
    ?.author_nickname || '上一位同学'
}
