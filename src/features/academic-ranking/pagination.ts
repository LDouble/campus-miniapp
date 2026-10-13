export type RankingPage<T extends { id: number }> = {
  items: T[]
  page: number
  page_size: number
  total: number
}

export type RankingPagination<T extends { id: number }> = RankingPage<T>

export type RankingPageLoad<T extends { id: number }> =
  | { ok: true; state: RankingPagination<T> }
  | { ok: false; state: RankingPagination<T>; error: unknown }

export type RankingPageRequestGate = ReturnType<typeof createRankingPageRequestGate>

export const createRankingPageRequestGate = () => {
  let sequence = 0
  let activeRequest = 0

  return {
    begin: () => {
      if (activeRequest) return null
      activeRequest = ++sequence
      return activeRequest
    },
    isActive: (requestId: number) => activeRequest === requestId,
    finish: (requestId: number) => {
      if (activeRequest !== requestId) return false
      activeRequest = 0
      return true
    },
    cancel: () => {
      sequence += 1
      activeRequest = 0
    },
  }
}

export const createRankingPagination = <T extends { id: number }>(pageSize = 20): RankingPagination<T> => ({
  items: [],
  page: 0,
  page_size: pageSize,
  total: 0,
})

export const canLoadMoreRankingItems = <T extends { id: number }>(state: RankingPagination<T>) => (
  state.page > 0
  && state.page_size > 0
  && state.page * state.page_size < state.total
)

export const mergeRankingPage = <T extends { id: number }>(
  current: RankingPagination<T>,
  next: RankingPage<T>,
  reset = false,
): RankingPagination<T> => {
  const items = reset ? [] : current.items
  const seen = new Set(items.map((item) => item.id))
  const mergedItems = [...items]
  for (const item of next.items) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    mergedItems.push(item)
  }
  return {
    items: mergedItems,
    page: next.page,
    page_size: next.page_size,
    total: next.total,
  }
}

export const requestRankingPage = async <T extends { id: number }>(
  current: RankingPagination<T>,
  request: () => Promise<RankingPage<T>>,
  reset = false,
): Promise<RankingPageLoad<T>> => {
  try {
    return { ok: true, state: mergeRankingPage(current, await request(), reset) }
  } catch (error) {
    return { ok: false, state: current, error }
  }
}
