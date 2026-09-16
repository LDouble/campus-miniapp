import { strict as assert } from 'node:assert'
import { createCommunityPostViewDispatcher } from '../src/features/community/post-view-dispatcher'

const readerToken = '0123456789abcdef0123456789abcdef'

void (async () => {
  let identity = 'guest:one'
  let timerCallback: (() => void) | undefined
  let batchCalls: number[][] = []
  const dispatcher = createCommunityPostViewDispatcher({
    getReaderToken: () => readerToken,
    getIdentity: () => identity,
    record: async () => ({ counted: true, view_count: 1 }),
    recordBatch: async (postIds) => {
      batchCalls.push(postIds)
      return { items: postIds.map((post_id) => ({ post_id, counted: true, view_count: post_id * 10 })) }
    },
    setTimeout: (callback) => {
      timerCallback = callback
      return 1 as unknown as ReturnType<typeof setTimeout>
    },
    clearTimeout: () => { timerCallback = undefined },
  })
  const first = dispatcher.report(1)
  const second = dispatcher.report(2)
  assert.equal(batchCalls.length, 0, '曝光应在三秒窗口内合并')
  timerCallback?.()
  assert.deepEqual(await Promise.all([first, second]), [
    { counted: true, view_count: 10 }, { counted: true, view_count: 20 },
  ])
  assert.deepEqual(batchCalls, [[1, 2]], '定时触发应只发一个批请求')

  const flushed = dispatcher.report(3)
  dispatcher.flush()
  await flushed
  assert.deepEqual(batchCalls[1], [3], 'flush 应立即发送队列中的曝光')

  let active = 0
  let peak = 0
  const releases: Array<() => void> = []
  const full = createCommunityPostViewDispatcher({
    getReaderToken: () => readerToken,
    getIdentity: () => identity,
    record: async () => ({ counted: true, view_count: 1 }),
    recordBatch: async (postIds) => {
      active += 1
      peak = Math.max(peak, active)
      await new Promise<void>((resolve) => releases.push(resolve))
      active -= 1
      return { items: postIds.map((post_id) => ({ post_id, counted: true })) }
    },
  })
  const all = Array.from({ length: 40 }, (_, index) => full.report(index + 10))
  await Promise.resolve()
  assert.equal(peak, 2, '满 20 条应提前发送，最多两个批请求并发')
  releases.splice(0).forEach((release) => release())
  await Promise.all(all)

  let fallbackBatchCalls = 0
  let fallbackSingles = 0
  const fallback = createCommunityPostViewDispatcher({
    getReaderToken: () => readerToken,
    getIdentity: () => identity,
    record: async (postId) => {
      fallbackSingles += 1
      return { counted: true, view_count: postId }
    },
    recordBatch: async () => {
      fallbackBatchCalls += 1
      throw Object.assign(new Error('not deployed'), { statusCode: 404 })
    },
    batchDelayMs: 60_000,
  })
  const fallbackOne = fallback.report(60)
  const fallbackTwo = fallback.report(61)
  fallback.flush()
  await Promise.all([fallbackOne, fallbackTwo])
  assert.equal(fallbackBatchCalls, 1)
  assert.equal(fallbackSingles, 2, '404 批接口应降级为单帖上报')
  await fallback.report(62)
  assert.equal(fallbackBatchCalls, 1, '本会话不应重复探测未部署的批接口')

  const changed = createCommunityPostViewDispatcher({
    getReaderToken: () => readerToken,
    getIdentity: () => identity,
    record: async () => ({ counted: true, view_count: 1 }),
    recordBatch: async (postIds) => ({ items: postIds.map((post_id) => ({ post_id, counted: true })) }),
    batchDelayMs: 60_000,
  })
  const stale = changed.report(70)
  identity = 'guest:two'
  changed.flush()
  assert.equal(await stale, null, '账号切换后的排队曝光不可提交')

  let rateBatchCalls = 0
  let rateSingles = 0
  const rateLimited = createCommunityPostViewDispatcher({
    getReaderToken: () => readerToken,
    getIdentity: () => identity,
    record: async () => {
      rateSingles += 1
      return { counted: true, view_count: 1 }
    },
    recordBatch: async () => {
      rateBatchCalls += 1
      throw Object.assign(new Error('too many requests'), { statusCode: 429 })
    },
    batchDelayMs: 60_000,
  })
  const throttled = rateLimited.report(80)
  rateLimited.flush()
  assert.equal(await throttled, null)
  assert.equal(rateBatchCalls, 1, '429 不应重试批请求')
  assert.equal(rateSingles, 0, '429 不得放大成单帖请求')
  assert.equal(await rateLimited.report(81), null, '429 冷却应抑制后续曝光')
  assert.equal(rateBatchCalls, 1)
  assert.equal(rateSingles, 0)

  let unavailableBatchCalls = 0
  let unavailableSingles = 0
  const unavailable = createCommunityPostViewDispatcher({
    getReaderToken: () => readerToken,
    getIdentity: () => identity,
    record: async () => {
      unavailableSingles += 1
      return { counted: true, view_count: 1 }
    },
    recordBatch: async () => {
      unavailableBatchCalls += 1
      throw Object.assign(new Error('temporary outage'), { statusCode: 503 })
    },
    batchDelayMs: 60_000,
  })
  const outage = unavailable.report(82)
  unavailable.flush()
  assert.equal(await outage, null)
  assert.equal(unavailableBatchCalls, 2, '5xx 批请求最多重试一次')
  assert.equal(unavailableSingles, 0, '5xx 不得降级放大为单帖请求')

  const incomplete = createCommunityPostViewDispatcher({
    getReaderToken: () => readerToken,
    getIdentity: () => identity,
    record: async () => ({ counted: true, view_count: 1 }),
    recordBatch: async () => ({ items: [{ post_id: 90, counted: true }] }),
    batchDelayMs: 60_000,
  })
  const noCount = incomplete.report(90)
  const missing = incomplete.report(91)
  incomplete.flush()
  assert.equal(await noCount, null, '缺少 view_count 不得伪造为零')
  assert.equal(await missing, null, '缺少结果项不得伪造计数')
  assert.equal(incomplete.getCount(90), undefined)
  assert.equal(incomplete.getCount(91), undefined)

  process.stdout.write('community post view batch smoke: ok\n')
})()
