import { strict as assert } from 'node:assert'
import { formatCommunityViewCount, getReaderToken, reportPostView } from '../src/features/community/post-view-utils'
import { createCommunityPostViewDispatcher } from '../src/features/community/post-view-dispatcher'

const values = new Map<string, unknown>()
const storage = {
  get: () => values.get('reader-token'),
  set: (value: string) => values.set('reader-token', value),
}

const firstToken = getReaderToken(storage)
assert.match(firstToken, /^[\x21-\x7e]{16,128}$/u)
assert.equal(getReaderToken(storage), firstToken)

void (async () => {
  let attempts = 0
  const result = await reportPostView(7, async (postId, readerToken) => {
    attempts += 1
    assert.equal(postId, 7)
    assert.equal(readerToken, firstToken)
    if (attempts === 1) throw new Error('temporary failure')
    return { counted: true, view_count: 128 }
  }, storage)
  assert.deepEqual(result, { counted: true, view_count: 128 })
  assert.equal(attempts, 2)

  assert.equal(formatCommunityViewCount(0), '0')
  assert.equal(formatCommunityViewCount(9999), '9999')
  assert.equal(formatCommunityViewCount(10000), '1.0万')
  assert.equal(formatCommunityViewCount(12500), '1.3万')
  assert.equal(formatCommunityViewCount(undefined), '—')

  let time = 10
  let identity = 'user:first'
  let active = 0
  let peak = 0
  let dispatched = 0
  const observed: number[] = []
  const dispatcher = createCommunityPostViewDispatcher({
    getReaderToken: () => firstToken,
    getIdentity: () => identity,
    now: () => time,
    maxConcurrent: 2,
    successSuppressMs: 30 * 60 * 1000,
    falseSuppressMs: 10,
    record: async (postId) => {
      dispatched += 1
      active += 1
      peak = Math.max(peak, active)
      await Promise.resolve()
      active -= 1
      return { counted: postId !== 9, view_count: postId * 10 }
    },
  })
  const unsubscribe = dispatcher.subscribe(8, (count) => observed.push(count))
  await Promise.all([dispatcher.report(8), dispatcher.report(8), dispatcher.report(9), dispatcher.report(10)])
  assert.equal(dispatched, 3, '同身份同帖应合并')
  assert.equal(peak, 2, '最多同时发送两条请求')
  assert.equal(dispatcher.getCount(8), 80)
  assert.deepEqual(observed, [80])
  assert.equal(await dispatcher.report(8), null, 'counted:true 应在窗口内抑制')
  time += 11
  await dispatcher.report(9)
  assert.equal(dispatched, 4, 'counted:false 只作短暂抑制')
  unsubscribe()

  let release: (() => void) | undefined
  const waiting = new Promise<void>((resolve) => { release = resolve })
  const isolated = createCommunityPostViewDispatcher({
    getReaderToken: () => firstToken,
    getIdentity: () => identity,
    maxConcurrent: 1,
    record: async () => { await waiting; return { counted: true, view_count: 1 } },
  })
  const blocking = isolated.report(12)
  const queued = isolated.report(11)
  identity = 'user:second'
  release?.()
  await blocking
  assert.equal(await queued, null, '排队后身份切换不可跨用户提交')

  let retryAttempts = 0
  const failures = createCommunityPostViewDispatcher({
    getReaderToken: () => firstToken,
    getIdentity: () => 'user:stable',
    now: () => time,
    record: async (postId) => {
      retryAttempts += 1
      if (postId === 13) throw new Error('network unavailable')
      throw Object.assign(new Error('too many requests'), { statusCode: 429 })
    },
  })
  assert.equal(await failures.report(13), null)
  assert.equal(retryAttempts, 2, '网络失败最多重试一次')
  assert.equal(await failures.report(13), null)
  assert.equal(retryAttempts, 2, '失败冷却期间不应继续上报')
  assert.equal(await failures.report(14), null)
  assert.equal(retryAttempts, 3, '429 不应立即重试')
  assert.equal(await failures.report(15), null)
  assert.equal(retryAttempts, 3, '429 的全局冷却应抑制其他帖子的请求')

  let queuedRateRelease: (() => void) | undefined
  const queuedRateWait = new Promise<void>((resolve) => { queuedRateRelease = resolve })
  let queuedRateAttempts = 0
  const queuedRateLimit = createCommunityPostViewDispatcher({
    getReaderToken: () => firstToken,
    getIdentity: () => 'user:queued-rate-limit',
    maxConcurrent: 1,
    now: () => time,
    record: async () => {
      queuedRateAttempts += 1
      await queuedRateWait
      throw Object.assign(new Error('too many requests'), { statusCode: 429 })
    },
  })
  const limited = queuedRateLimit.report(18)
  const skippedFromQueue = queuedRateLimit.report(19)
  queuedRateRelease?.()
  assert.equal(await limited, null)
  assert.equal(await skippedFromQueue, null)
  assert.equal(queuedRateAttempts, 1, '429 后已排队帖子不应继续请求')

  let delayedResolve: (() => void) | undefined
  const delayed = new Promise<void>((resolve) => { delayedResolve = resolve })
  let delayedAttempts = 0
  const identityOnRetry = createCommunityPostViewDispatcher({
    getReaderToken: () => firstToken,
    getIdentity: () => identity,
    record: async () => {
      delayedAttempts += 1
      if (delayedAttempts === 1) {
        await delayed
        throw new Error('temporary failure')
      }
      return { counted: true, view_count: 2 }
    },
  })
  identity = 'user:before-retry'
  const retried = identityOnRetry.report(16)
  identity = 'user:after-retry'
  delayedResolve?.()
  assert.equal(await retried, null, '重试前应再次验证身份')
  assert.equal(delayedAttempts, 1)

  let responseReady: (() => void) | undefined
  const responseWait = new Promise<void>((resolve) => { responseReady = resolve })
  let timedAttempts = 0
  time = 100
  const requestTimeWindow = createCommunityPostViewDispatcher({
    getReaderToken: () => firstToken,
    getIdentity: () => 'user:time-window',
    now: () => time,
    successSuppressMs: 10,
    record: async () => {
      timedAttempts += 1
      await responseWait
      return { counted: true, view_count: 3 }
    },
  })
  const initial = requestTimeWindow.report(17)
  time = 111
  responseReady?.()
  await initial
  // The request began at 100, so its 10ms client window is already over even
  // though its response arrived at 111.
  const later = requestTimeWindow.report(17)
  await Promise.resolve()
  assert.equal(timedAttempts, 2, '成功抑制窗口应从请求启动时计算')
  await later

  const readFailureStorage = { get: () => { throw new Error('read unavailable') }, set: () => undefined }
  assert.equal(getReaderToken(readFailureStorage), getReaderToken(readFailureStorage), '读取存储失败也应复用会话 token')
  const countCache = createCommunityPostViewDispatcher({
    getReaderToken: () => firstToken,
    getIdentity: () => 'guest',
    maxCachedCounts: 1,
    record: async () => ({ counted: true, view_count: 1 }),
  })
  let cachedObserved = 0
  const unsubscribeCache = countCache.subscribe(20, (count) => { cachedObserved = count })
  countCache.observeCount(20, 100)
  countCache.observeCount(20, 80)
  assert.equal(cachedObserved, 100, '旧 GET 快照不得覆盖较新服务端计数')
  countCache.observeCount(21, 30)
  assert.equal(countCache.getCount(20), 100, 'LRU 不得驱逐仍在展示的计数')
  unsubscribeCache()

  process.stdout.write('community post view smoke: ok\n')
})()
