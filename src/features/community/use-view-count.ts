import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { getCommunityViewCount, observeCommunityViewCount, subscribeCommunityViewCount } from './post-view'

/** 服务端上报结果跨列表、快照和详情共享，旧响应不能让累计数倒退。 */
export const useCommunityViewCount = (postId: number, serverCount?: number | null) => {
  const subscribe = useCallback((listener: () => void) => (
    subscribeCommunityViewCount(postId, listener)
  ), [postId])
  const getSnapshot = useCallback(() => getCommunityViewCount(postId), [postId])
  const reportedCount = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const knownCount = Number.isFinite(serverCount) ? Math.max(0, serverCount!) : 0
  const previous = useRef({ postId, count: 0 })
  const viewCount = Math.max(knownCount, reportedCount ?? 0, previous.current.postId === postId ? previous.current.count : 0)
  previous.current = { postId, count: viewCount }
  useEffect(() => {
    if (knownCount > 0) observeCommunityViewCount(postId, knownCount)
  }, [postId, knownCount])
  return viewCount
}
