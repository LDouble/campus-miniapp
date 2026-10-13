import type { CampusCirclePostView, CommentView } from '../../api/types'

export type TodayHotDetailReturn = {
  post?: CampusCirclePostView
  approvedCommentDelta?: number
  comment?: CommentView
  expiresAt: number
}

const ttlMs = 30 * 60_000
const updates = new Map<number, TodayHotDetailReturn>()

export const saveTodayHotDetailReturn = (postId: number, patch: Omit<TodayHotDetailReturn, 'expiresAt'>) => {
  if (!Number.isInteger(postId) || postId <= 0) return
  const current = updates.get(postId)
  updates.set(postId, {
    ...current,
    ...patch,
    approvedCommentDelta: (current?.approvedCommentDelta || 0) + (patch.approvedCommentDelta || 0),
    expiresAt: Date.now() + ttlMs,
  })
}

export const consumeTodayHotDetailReturn = (postId: number) => {
  const value = updates.get(postId)
  updates.delete(postId)
  return value && value.expiresAt > Date.now() ? value : null
}
