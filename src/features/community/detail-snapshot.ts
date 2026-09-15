import type { CampusCirclePostView } from '../../api/types'

/**
 * 列表页到详情页的短暂内存交接。它不参与分享或冷启动，因此详情页仍可安全地
 * 通过 id 回退到详情接口。
 */
const COMMUNITY_DETAIL_SNAPSHOT_TTL = 30_000
const COMMUNITY_DETAIL_SNAPSHOT_LIMIT = 12

type CommunityDetailSnapshot = {
  post: CampusCirclePostView
  expiresAt: number
}

const snapshots = new Map<number, CommunityDetailSnapshot>()

const discardExpiredSnapshots = (now: number) => {
  snapshots.forEach((snapshot, id) => {
    if (snapshot.expiresAt <= now) snapshots.delete(id)
  })
}

export const saveCommunityDetailSnapshot = (
  post: CampusCirclePostView,
  now = Date.now(),
) => {
  const id = Number(post.id)
  if (!Number.isInteger(id) || id <= 0) return

  discardExpiredSnapshots(now)
  snapshots.delete(id)
  snapshots.set(id, {
    post,
    expiresAt: now + COMMUNITY_DETAIL_SNAPSHOT_TTL,
  })
  while (snapshots.size > COMMUNITY_DETAIL_SNAPSHOT_LIMIT) {
    const oldestId = snapshots.keys().next().value
    if (oldestId === undefined) break
    snapshots.delete(oldestId)
  }
}

export const consumeCommunityDetailSnapshot = (id: number, now = Date.now()) => {
  discardExpiredSnapshots(now)
  const snapshot = snapshots.get(id)
  // 无论是否过期，读取都只能发生一次，避免后续同 id 入口误用旧列表数据。
  snapshots.delete(id)
  return snapshot?.post || null
}

export const communityDetailSnapshotTtl = COMMUNITY_DETAIL_SNAPSHOT_TTL
