import type { RecordPostView } from './post-view-utils'

export type CommunityViewResult = { counted: boolean; view_count: number }
export type CommunityViewCountListener = (count: number) => void

type PendingView = {
  postId: number
  readerToken: string
  identity: string
  resolve: (result: CommunityViewResult | null) => void
}

export type CommunityPostViewDispatcherOptions = {
  record: RecordPostView
  getIdentity: (readerToken: string) => string
  getReaderToken: () => string
  now?: () => number
  maxConcurrent?: number
  maxQueueSize?: number
  successSuppressMs?: number
  falseSuppressMs?: number
  failureCooldownMs?: number
  rateLimitCooldownMs?: number
  maxCachedCounts?: number
}

const isValidPostId = (postId: number) => Number.isInteger(postId) && postId > 0

const statusOf = (error: unknown) => {
  if (!error || typeof error !== 'object') return undefined
  const candidate = error as { status?: unknown; statusCode?: unknown; response?: { status?: unknown } }
  const status = candidate.statusCode ?? candidate.status ?? candidate.response?.status
  return typeof status === 'number' ? status : undefined
}

const retryable = (error: unknown) => {
  const status = statusOf(error)
  return status === undefined || status >= 500
}

/**
 * A small, framework-independent scheduler. Keeping it independent from Taro
 * makes its coalescing, retry and identity behaviour testable without a page.
 */
export const createCommunityPostViewDispatcher = (options: CommunityPostViewDispatcherOptions) => {
  const now = options.now || Date.now
  const maxConcurrent = options.maxConcurrent || 2
  const maxQueueSize = options.maxQueueSize || 120
  const successSuppressMs = options.successSuppressMs || 30 * 60 * 1000
  const falseSuppressMs = options.falseSuppressMs || 15 * 1000
  const failureCooldownMs = options.failureCooldownMs || 15 * 1000
  const rateLimitCooldownMs = options.rateLimitCooldownMs || 15 * 1000
  const maxCachedCounts = options.maxCachedCounts || 300
  const queue: PendingView[] = []
  const pending = new Map<string, Promise<CommunityViewResult | null>>()
  const suppressUntil = new Map<string, number>()
  const rateLimitUntil = new Map<string, number>()
  const counts = new Map<number, number>()
  const listeners = new Map<number, Set<CommunityViewCountListener>>()
  let active = 0
  let globalRateLimitUntil = 0

  const keyFor = (identity: string, postId: number) => `${identity}\u0000${postId}`
  const trim = <T>(map: Map<unknown, T>, limit: number) => {
    while (map.size > limit) map.delete(map.keys().next().value as never)
  }
  const setSuppressUntil = (key: string, until: number) => {
    suppressUntil.delete(key)
    suppressUntil.set(key, until)
    trim(suppressUntil, maxCachedCounts)
  }
  const setRateLimitUntil = (identity: string, until: number) => {
    rateLimitUntil.delete(identity)
    rateLimitUntil.set(identity, until)
    trim(rateLimitUntil, maxCachedCounts)
  }
  const trimCounts = () => {
    for (const postId of counts.keys()) {
      if (counts.size <= maxCachedCounts) return
      if (!listeners.get(postId)?.size) counts.delete(postId)
    }
  }
  const isRateLimited = (identity: string, timestamp: number) => (
    globalRateLimitUntil > timestamp || (rateLimitUntil.get(identity) || 0) > timestamp
  )
  const publishCount = (postId: number, count: number) => {
    const previous = counts.get(postId)
    // The server is authoritative, but never let a delayed response make a
    // visible count go backwards in this runtime.
    const next = previous === undefined ? count : Math.max(previous, count)
    counts.delete(postId)
    counts.set(postId, next)
    trimCounts()
    listeners.get(postId)?.forEach((listener) => {
      try {
        listener(next)
      } catch {
        // A view callback must not leave the reporting task unresolved.
      }
    })
  }
  const run = async (task: PendingView) => {
    const key = keyFor(task.identity, task.postId)
    try {
      let result: CommunityViewResult | null = null
      let requestStartedAt = now()
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          // A session can change while this item waits or while a prior request
          // is in flight. Do not submit a previous user's event after it does.
          if (options.getIdentity(task.readerToken) !== task.identity) {
            task.resolve(null)
            return
          }
          if (isRateLimited(task.identity, now())) {
            task.resolve(null)
            return
          }
          if (attempt === 0) requestStartedAt = now()
          result = await options.record(task.postId, task.readerToken)
          break
        } catch (error) {
          if (statusOf(error) === 429) {
            const until = now() + rateLimitCooldownMs
            globalRateLimitUntil = until
            setRateLimitUntil(task.identity, until)
          }
          if (attempt || !retryable(error)) break
        }
      }
      if (result) {
        setSuppressUntil(key, requestStartedAt + (result.counted ? successSuppressMs : falseSuppressMs))
        if (Number.isFinite(result.view_count) && result.view_count >= 0) publishCount(task.postId, result.view_count)
        task.resolve(result)
      } else {
        setSuppressUntil(key, now() + failureCooldownMs)
        task.resolve(null)
      }
    } catch {
      setSuppressUntil(key, now() + failureCooldownMs)
      task.resolve(null)
    } finally {
      pending.delete(key)
      active -= 1
      pump()
    }
  }
  const pump = () => {
    while (active < maxConcurrent && queue.length) {
      const task = queue.shift()
      if (!task) return
      active += 1
      void run(task)
    }
  }
  const report = (postId: number): Promise<CommunityViewResult | null> => {
    if (!isValidPostId(postId)) return Promise.resolve(null)
    let readerToken: string
    let identity: string
    try {
      readerToken = options.getReaderToken()
      identity = options.getIdentity(readerToken)
    } catch {
      return Promise.resolve(null)
    }
    const key = keyFor(identity, postId)
    const activeTask = pending.get(key)
    if (activeTask) return activeTask
    const timestamp = now()
    if (isRateLimited(identity, timestamp)) return Promise.resolve(null)
    if ((suppressUntil.get(key) || 0) > timestamp) return Promise.resolve(null)
    if (queue.length >= maxQueueSize) return Promise.resolve(null)
    let resolveTask: (result: CommunityViewResult | null) => void = () => undefined
    const taskPromise = new Promise<CommunityViewResult | null>((resolve) => { resolveTask = resolve })
    pending.set(key, taskPromise)
    queue.push({ postId, readerToken, identity, resolve: resolveTask })
    pump()
    return taskPromise
  }
  const subscribe = (postId: number, listener: CommunityViewCountListener) => {
    if (!isValidPostId(postId)) return () => undefined
    const postListeners = listeners.get(postId) || new Set<CommunityViewCountListener>()
    postListeners.add(listener)
    listeners.set(postId, postListeners)
    return () => {
      postListeners.delete(listener)
      if (!postListeners.size) listeners.delete(postId)
      trimCounts()
    }
  }
  const observeCount = (postId: number, count: number) => {
    if (isValidPostId(postId) && Number.isFinite(count) && count >= 0) publishCount(postId, count)
  }
  return { report, subscribe, observeCount, getCount: (postId: number) => counts.get(postId) }
}

export type CommunityPostViewDispatcher = ReturnType<typeof createCommunityPostViewDispatcher>
