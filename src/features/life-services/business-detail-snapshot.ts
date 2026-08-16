import type {
  CarpoolTripView,
  ErrandView,
  MarketplaceListingView,
} from '../../api/types'

/**
 * 列表页到业务详情页的短暂内存交接。快照只由带 snapshot=1 的站内导航消费，
 * 分享、通知和冷启动仍需由详情接口加载。
 */
const BUSINESS_DETAIL_SNAPSHOT_TTL = 30_000
const BUSINESS_DETAIL_SNAPSHOT_LIMIT = 18

export type BusinessDetailType = 'marketplace' | 'errand' | 'carpool'

export type BusinessDetailItems = {
  marketplace: MarketplaceListingView
  errand: ErrandView
  carpool: CarpoolTripView
}

export type BusinessDetailItem<T extends BusinessDetailType> = BusinessDetailItems[T]

type BusinessDetailSnapshot = {
  item: BusinessDetailItems[BusinessDetailType]
  expiresAt: number
}

const snapshots = new Map<string, BusinessDetailSnapshot>()

const snapshotKey = (type: BusinessDetailType, id: number) => `${type}:${id}`

const discardExpiredSnapshots = (now: number) => {
  snapshots.forEach((snapshot, key) => {
    if (snapshot.expiresAt <= now) snapshots.delete(key)
  })
}

export const saveBusinessDetailSnapshot = <T extends BusinessDetailType>(
  type: T,
  item: BusinessDetailItem<T>,
  now = Date.now(),
) => {
  const id = Number(item.id)
  if (!Number.isInteger(id) || id <= 0) return

  discardExpiredSnapshots(now)
  const key = snapshotKey(type, id)
  snapshots.delete(key)
  snapshots.set(key, {
    item,
    expiresAt: now + BUSINESS_DETAIL_SNAPSHOT_TTL,
  })
  while (snapshots.size > BUSINESS_DETAIL_SNAPSHOT_LIMIT) {
    const oldestKey = snapshots.keys().next().value
    if (oldestKey === undefined) break
    snapshots.delete(oldestKey)
  }
}

export const consumeBusinessDetailSnapshot = <T extends BusinessDetailType>(
  type: T,
  id: number,
  now = Date.now(),
): BusinessDetailItem<T> | null => {
  discardExpiredSnapshots(now)
  const key = snapshotKey(type, id)
  const snapshot = snapshots.get(key)
  // 无论是否过期，读取都只能发生一次，避免同 id 的后续入口误用旧列表数据。
  snapshots.delete(key)
  return (snapshot?.item as BusinessDetailItem<T> | undefined) || null
}

export const businessDetailSnapshotTtl = BUSINESS_DETAIL_SNAPSHOT_TTL
