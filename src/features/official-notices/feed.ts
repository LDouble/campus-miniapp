import type { OfficialNotice } from './types'

export const mergeOfficialNoticeFeed = (
  current: OfficialNotice[],
  incoming: OfficialNotice[],
) => {
  const ids = new Set(current.map((item) => item.id))
  return current.concat(incoming.filter((item) => !ids.has(item.id)))
}

export const canLoadOfficialNoticeFeed = (
  loadingMore: boolean,
  hasMore: boolean,
  nextCursor: string | null,
) => !loadingMore && hasMore && Boolean(nextCursor)
