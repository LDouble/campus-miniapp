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

export type CommentTreeNode<T extends Pick<CommentView, 'id' | 'parent_id'>> = {
  comment: T
  children: CommentTreeNode<T>[]
}

/** 将接口返回的扁平 descendants 按 parent_id 还原为稳定评论树。 */
export const buildCommentTree = <T extends Pick<CommentView, 'id' | 'parent_id'>>(
  rootId: number,
  descendants: T[],
): CommentTreeNode<T>[] => {
  const nodes = new Map<number, CommentTreeNode<T>>(
    descendants.map((comment) => [comment.id, { comment, children: [] }]),
  )
  const roots: CommentTreeNode<T>[] = []

  const createsCycle = (commentId: number, parentId: number) => {
    const visited = new Set<number>([commentId])
    let currentId: number | null | undefined = parentId
    while (currentId && currentId !== rootId) {
      if (visited.has(currentId)) return true
      visited.add(currentId)
      currentId = nodes.get(currentId)?.comment.parent_id
    }
    return false
  }

  nodes.forEach((node) => {
    const parentId = node.comment.parent_id
    const parent = parentId && parentId !== rootId ? nodes.get(parentId) : undefined
    if (parent && !createsCycle(node.comment.id, Number(parentId))) parent.children.push(node)
    else roots.push(node)
  })

  const sortTree = (items: CommentTreeNode<T>[]) => {
    items.sort((left, right) => left.comment.id - right.comment.id)
    items.forEach((item) => sortTree(item.children))
  }
  sortTree(roots)
  return roots
}

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
