import type { CommentView, PublicCommentPreview } from '../../api/types'

type CommentReplyTarget = Pick<CommentView, 'id'>

type PublicReplyTarget = {
  id: number
  authorNickname: string
}

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

export const commentToPublicPreview = (
  comment: CommentView,
  replyTarget: PublicReplyTarget | null = null,
): PublicCommentPreview => ({
  id: comment.id,
  author_id: comment.author_id,
  author_nickname: comment.author_deleted ? '已注销用户' : comment.author_nickname,
  parent_id: comment.parent_id ?? null,
  root_id: comment.root_id || comment.id,
  reply_to_comment_id: comment.parent_id ?? null,
  reply_to_nickname: comment.parent_id ? replyTarget?.authorNickname || null : null,
  content: comment.content,
  created_at: comment.created_at,
})

/** 保留服务端分组的新鲜度，同时保证可见根评论始终排在它的回复之前。 */
export const orderPublicCommentPreviews = (items: PublicCommentPreview[]) => {
  const groups = new Map<number, {
    firstIndex: number
    root: PublicCommentPreview | null
    replies: PublicCommentPreview[]
  }>()

  items.forEach((item, index) => {
    const groupId = item.parent_id ? item.root_id : item.id
    const group = groups.get(groupId) || { firstIndex: index, root: null, replies: [] }
    group.firstIndex = Math.min(group.firstIndex, index)
    if (item.parent_id) group.replies.push(item)
    else group.root = item
    groups.set(groupId, group)
  })

  return [...groups.values()]
    .sort((left, right) => left.firstIndex - right.firstIndex)
    .flatMap((group) => group.root ? [group.root, ...group.replies] : group.replies)
}

/** 将本地新评论合并进服务端公开预览；回复会与对应根评论一起置顶展示。 */
export const mergePublicCommentPreview = (
  current: PublicCommentPreview[],
  created: CommentView,
  replyTarget: PublicReplyTarget | null = null,
) => {
  const preview = commentToPublicPreview(created, replyTarget)
  const remaining = orderPublicCommentPreviews(
    current.filter((item) => item.id !== preview.id),
  )

  if (!preview.parent_id) return orderPublicCommentPreviews([preview, ...remaining])

  const rootIndex = remaining.findIndex((item) => item.id === preview.root_id)
  if (rootIndex < 0) return orderPublicCommentPreviews([preview, ...remaining])

  const root = remaining[rootIndex]
  return orderPublicCommentPreviews([
    root,
    preview,
    ...remaining.filter((_, index) => index !== rootIndex),
  ])
}

export const commentReplyTargetName = (
  comment: Pick<CommentView, 'reply_to_user_id'>,
  thread: Pick<CommentView, 'author_id' | 'author_nickname'>[],
) => {
  if (!comment.reply_to_user_id) return ''
  return thread.find((item) => item.author_id === comment.reply_to_user_id)
    ?.author_nickname || '上一位同学'
}
