import type { RecordPostView, RecordPostViews } from './post-view-utils'

export type CommunityViewResult = { counted: boolean; view_count: number }
type RemoteViewResult = { counted: boolean; view_count?: number }
export type CommunityViewCountListener = (count: number) => void

type PendingView = {
  postId: number
  readerToken: string
  identity: string
  resolve: (result: CommunityViewResult | null) => void
}

export type CommunityPostViewDispatcherOptions = {
  record: RecordPostView
  recordBatch?: RecordPostViews
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
  batchDelayMs?: number
  batchSize?: number
  setTimeout?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>
  clearTimeout?: (timer: ReturnType<typeof setTimeout>) => void
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

const isBatchUnavailable = (error: unknown) => {
  const status = statusOf(error)
  return status === 404 || status === 405
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
  const batchDelayMs = options.batchDelayMs || 3_000
  const batchSize = options.batchSize || 20
  const scheduleTimeout = options.setTimeout || setTimeout
  const cancelTimeout = options.clearTimeout || clearTimeout
  const queue: PendingView[] = []
  const pending = new Map<string, Promise<CommunityViewResult | null>>()
  const suppressUntil = new Map<string, number>()
  const rateLimitUntil = new Map<string, number>()
  const counts = new Map<number, number>()
  const listeners = new Map<number, Set<CommunityViewCountListener>>()
  let active = 0
  let globalRateLimitUntil = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let flushRequested = false
  let batchUnavailable = !options.recordBatch

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
  const finish = (task: PendingView, result: RemoteViewResult | null, requestStartedAt: number) => {
    const key = keyFor(task.identity, task.postId)
    if (result) {
      setSuppressUntil(key, requestStartedAt + (result.counted ? successSuppressMs : falseSuppressMs))
      if (Number.isFinite(result.view_count) && (result.view_count as number) >= 0) publishCount(task.postId, result.view_count as number)
    } else {
      setSuppressUntil(key, now() + failureCooldownMs)
    }
    pending.delete(key)
    task.resolve(result && Number.isFinite(result.view_count) && (result.view_count as number) >= 0
      ? { counted: result.counted, view_count: result.view_count as number }
      : null)
  }
  const valid = (task: PendingView) => (
    options.getIdentity(task.readerToken) === task.identity && !isRateLimited(task.identity, now())
  )
  const recordOne = async (task: PendingView): Promise<RemoteViewResult | null> => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        if (!valid(task)) return null
        return await options.record(task.postId, task.readerToken)
      } catch (error) {
        if (statusOf(error) === 429) {
          const until = now() + rateLimitCooldownMs
          globalRateLimitUntil = until
          setRateLimitUntil(task.identity, until)
        }
        if (attempt || !retryable(error)) return null
      }
    }
    return null
  }
  const runSingles = async (tasks: PendingView[], requestStartedAt: number) => {
    for (const task of tasks) finish(task, await recordOne(task), requestStartedAt)
  }
  const run = async (tasks: PendingView[]) => {
    const requestStartedAt = now()
    try {
      if (batchUnavailable || !options.recordBatch) {
        await runSingles(tasks, requestStartedAt)
        return
      }
      let response: Awaited<ReturnType<RecordPostViews>> | null = null
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const validTasks = tasks.filter(valid)
          if (!validTasks.length) {
            tasks.forEach((task) => finish(task, null, requestStartedAt))
            return
          }
          // A changed identity invalidates the whole batch; never submit a
          // former account's impressions under the current account.
          if (validTasks.length !== tasks.length) {
            tasks.forEach((task) => finish(task, null, requestStartedAt))
            return
          }
          response = await options.recordBatch(tasks.map((task) => task.postId), tasks[0].readerToken)
          break
        } catch (error) {
          if (isBatchUnavailable(error)) {
            batchUnavailable = true
            await runSingles(tasks, requestStartedAt)
            return
          }
          if (statusOf(error) === 429) {
            const until = now() + rateLimitCooldownMs
            globalRateLimitUntil = until
            setRateLimitUntil(tasks[0].identity, until)
          }
          if (attempt || !retryable(error)) break
        }
      }
      if (!response) {
        tasks.forEach((task) => finish(task, null, requestStartedAt))
        return
      }
      const byPostId = new Map(response.items.map((item) => [item.post_id, item]))
      tasks.forEach((task) => {
        const item = byPostId.get(task.postId)
        finish(task, item ? { counted: item.counted, view_count: item.view_count } : null, requestStartedAt)
      })
    } catch {
      tasks.forEach((task) => finish(task, null, requestStartedAt))
    } finally {
      active -= 1
      pump()
    }
  }
  const takeBatch = () => {
    const first = queue.shift()
    if (!first) return []
    const tasks = [first]
    for (let index = 0; index < queue.length && tasks.length < batchSize;) {
      if (queue[index].identity === first.identity && queue[index].readerToken === first.readerToken) {
        tasks.push(queue[index])
        queue.splice(index, 1)
      } else index += 1
    }
    return tasks
  }
  const schedule = () => {
    if (timer || !queue.length || batchUnavailable) return
    timer = scheduleTimeout(() => {
      timer = undefined
      flushRequested = true
      pump()
    }, batchDelayMs)
  }
  const pump = () => {
    while (active < maxConcurrent && queue.length && (batchUnavailable || flushRequested || queue.length >= batchSize)) {
      const tasks = takeBatch()
      if (!tasks.length) return
      active += 1
      void run(tasks)
    }
    if (!queue.length) flushRequested = false
    if (queue.length && !flushRequested && !batchUnavailable && queue.length < batchSize) schedule()
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
    if (batchUnavailable || queue.length >= batchSize) pump()
    else schedule()
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
  const flush = () => {
    if (timer) {
      cancelTimeout(timer)
      timer = undefined
    }
    flushRequested = true
    pump()
  }
  return { report, flush, subscribe, observeCount, getCount: (postId: number) => counts.get(postId) }
}

export type CommunityPostViewDispatcher = ReturnType<typeof createCommunityPostViewDispatcher>
