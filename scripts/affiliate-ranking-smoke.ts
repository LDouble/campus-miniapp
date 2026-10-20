import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import Module = require('node:module')
import type {
  AffiliateRankingCategory,
  AffiliateRankingItem,
} from '../src/api/affiliate'
import {
  AFFILIATE_RANKING_CATEGORY_ORDER,
  AffiliateRankingRequestCoordinator,
  appendUniqueAffiliateRankingItems,
  getAffiliateRankingCategoryState,
  getAffiliateRankingCategoryTimestamp,
  getAffiliateRankingSnapshotRestart,
  hasMoreAffiliateRankingPages,
  sortAffiliateRankingCategories,
} from '../src/features/affiliate/rankings/policy'

const categories: AffiliateRankingCategory[] = [
  { id: 13, name: '户外后端名', count: 3, synced_at: '2026-10-20T03:00:00Z', state: 'ready' },
  { id: 8, name: '数码家电', count: 2, synced_at: null, state: 'ready' },
  { id: 4, name: '居家后端名', count: 4, synced_at: '2026-10-20T04:00:00Z', state: 'stale' },
  { id: 7, name: '文娱车品', count: 1, synced_at: null, state: 'pending' },
  { id: 6, name: '美食后端名', count: 5, synced_at: '2026-10-20T02:00:00Z', state: 'ready' },
  { id: 11, name: '箱包', count: 1, synced_at: null, state: 'failed' },
]
const sortedCategories = sortAffiliateRankingCategories(categories)
assert.deepEqual(sortedCategories.map((category) => category.id), [4, 6, 13])
assert.deepEqual(AFFILIATE_RANKING_CATEGORY_ORDER, [4, 6, 3, 1, 14, 5, 9, 12, 13])
assert.equal(sortedCategories[0].name, '居家后端名', '界面分类名应取后端元数据')
assert.equal(sortedCategories.some((category) => [7, 8, 11].includes(category.id)), false)
assert.equal(getAffiliateRankingCategoryState(sortedCategories, undefined), 'partial')
assert.equal(getAffiliateRankingCategoryState(sortedCategories, 4), 'stale')
assert.equal(getAffiliateRankingCategoryState([], undefined), 'empty')
assert.equal(getAffiliateRankingCategoryTimestamp(sortedCategories, undefined), '2026-10-20T04:00:00Z')
assert.equal(hasMoreAffiliateRankingPages(1, 20, 21), true)
assert.equal(hasMoreAffiliateRankingPages(2, 20, 21), false)
assert.deepEqual(getAffiliateRankingSnapshotRestart(2, 6, 409), { page: 1, categoryId: 6 })
assert.equal(getAffiliateRankingSnapshotRestart(1, 6, 409), null)
assert.equal(getAffiliateRankingSnapshotRestart(2, 6, 502), null)

const rankingItem = (goodsId: string, categoryId: number, twoHoursSales: number | null): AffiliateRankingItem => ({
  goods: {
    goods_id: goodsId,
    title: `商品 ${goodsId}`,
    availability: 'valid',
    coupon_status: 'none',
  },
  category_id: categoryId,
  two_hours_sales: twoHoursSales,
})
const deduplicated = appendUniqueAffiliateRankingItems(
  [rankingItem('opaque-001', 4, 7), rankingItem('001', 6, null)],
  [rankingItem('opaque-001', 6, 9)],
)
assert.deepEqual(deduplicated.map((item) => item.goods.goods_id), ['opaque-001', '001'])
assert.equal(deduplicated[0].category_id, 6, '重复项采用最新榜单数据且不改变首次出现位置')
assert.equal(deduplicated[1].goods.goods_id, '001', '不透明商品标识按原字符串精确区分')

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((complete) => { resolve = complete })
  return { promise, resolve }
}
const flush = async () => { for (let index = 0; index < 12; index += 1) await Promise.resolve() }

async function verifyRequestCoordination() {
  const coordinator = new AffiliateRankingRequestCoordinator()
  coordinator.setScope(true, true)
  const commits: string[] = []
  const oldResponse = deferred<string>()
  const newResponse = deferred<string>()
  const oldIdentity = coordinator.begin(4, 1)
  const oldTask = oldResponse.promise.then((value) => {
    if (coordinator.isCurrent(oldIdentity)) commits.push(value)
  })
  const newIdentity = coordinator.begin(6, 1)
  const newTask = newResponse.promise.then((value) => {
    if (coordinator.isCurrent(newIdentity)) commits.push(value)
  })
  newResponse.resolve('美食最新响应')
  await newTask
  oldResponse.resolve('居家旧响应')
  await oldTask
  assert.deepEqual(commits, ['美食最新响应'], '切换分类后旧响应不能覆盖当前榜单')

  const pageOne = coordinator.begin(undefined, 1)
  const pageTwo = coordinator.begin(undefined, 2)
  assert.equal(coordinator.isCurrent(pageOne), false, '请求下一页后，第一页重放的旧响应不能覆盖新状态')
  assert.equal(coordinator.isCurrent(pageTwo), true)

  coordinator.setScope(false, true)
  assert.equal(coordinator.isCurrent(pageTwo), false, '页面隐藏后未完成请求不能产生副作用')
  coordinator.setScope(true, true)
  const enabledRequest = coordinator.begin(4, 1)
  coordinator.setScope(true, false)
  assert.equal(coordinator.isCurrent(enabledRequest), false, '好物能力关闭后旧请求不能恢复榜单')
  await flush()
}

async function verifyRankingApiQuery() {
  const originalLoad = (Module as any)._load
  let captured: { path: string; query: Record<string, unknown> } | undefined
  ;(Module as any)._load = function (request: string, parent: { filename?: string }, isMain: boolean) {
    if (request === './client' && parent?.filename?.endsWith('/src/api/affiliate.ts')) {
      return { apiRequest: async (options: { path: string; query: Record<string, unknown> }) => {
        captured = options
        return { enabled: true, items: [], categories: [], total: 0, page: 1, page_size: 20, snapshot_id: 'snapshot' }
      } }
    }
    return originalLoad.call(this, request, parent, isMain)
  }

  try {
    const { listAffiliateRankings } = require('../src/api/affiliate') as typeof import('../src/api/affiliate')
    await listAffiliateRankings({ category_id: 4, page: 2, page_size: 20, snapshot_id: 'snapshot-1' })
    assert.deepEqual(captured, {
      path: '/api/v1/affiliate/rankings',
      query: { category_id: 4, page: 2, page_size: 20, snapshot_id: 'snapshot-1' },
    })
    await listAffiliateRankings({ page: 1, page_size: 20 })
    assert.deepEqual(captured?.query, { category_id: undefined, page: 1, page_size: 20, snapshot_id: undefined }, '综合榜省略分类与快照查询参数')
  } finally {
    ;(Module as any)._load = originalLoad
  }
}

const sectionSource = readFileSync('src/features/affiliate/rankings/ranking-section.tsx', 'utf8')
const homeSource = readFileSync('src/pages/goods/index.tsx', 'utf8')
assert.match(sectionSource, /onEnabledChange\(false\)/u, '仅后端明确关闭时通知首页关闭榜单')
assert.match(sectionSource, /salesLabel=\{item\.two_hours_sales === null/u, '销量未知时必须隐藏销量文案')
assert.match(sectionSource, /cacheAffiliateGoods\(item\.goods\)/u, '打开详情前缓存完整商品快照')
assert.match(sectionSource, /detail\?goods_id=\$\{encodeURIComponent\(item\.goods\.goods_id\)\}/u, '榜单详情按商品标识进入现有详情流程')
assert.match(sectionSource, /onBuy=\{onBuy\}/u, '榜单购买必须复用当前推广位购买回调')
assert.match(homeSource, /rankingsEnabled !== true/u, '自动榜单启用时隐藏空的人工精选大空态')
assert.match(homeSource, /<AffiliateRankingSection/u, '首页应展示独立自动榜单区')

void Promise.all([verifyRequestCoordination(), verifyRankingApiQuery()])
  .then(() => console.log('affiliate ranking category, snapshot, request scope and API query: ok'))
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
    process.exitCode = 1
  })
