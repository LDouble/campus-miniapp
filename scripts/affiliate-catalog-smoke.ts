import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import Module = require('node:module')
import type {
  AffiliateCatalogItem,
  AffiliateCatalogTag,
} from '../src/api/affiliate'
import {
  AFFILIATE_CATALOG_DAILY_TAG_ORDER,
  AffiliateCatalogRequestCoordinator,
  appendUniqueAffiliateCatalogItems,
  createAffiliateCatalogLoadMoreHandlers,
  formatAffiliateCatalogMonthSales,
  getAffiliateCatalogSnapshotRestart,
  hasMoreAffiliateCatalogPages,
  shouldShowAffiliateCatalogLegacyFallback,
  sortAffiliateCatalogDailyTags,
} from '../src/features/affiliate/catalog/policy'

assert.deepEqual(AFFILIATE_CATALOG_DAILY_TAG_ORDER, [
  'sanitary_pads',
  'tissues',
  'toothpaste',
  'laundry_detergent',
  'mouthwash',
  'body_wash',
  'laundry_beads',
  'condoms',
  'toilet_wipes',
  'pocket_tissues',
])
assert.equal(shouldShowAffiliateCatalogLegacyFallback(null), false, '接口状态未知时不显示旧推荐列表')
assert.equal(shouldShowAffiliateCatalogLegacyFallback(true), false, '商品库启用时只显示商品库feed')
assert.equal(shouldShowAffiliateCatalogLegacyFallback(false), true, '仅明确关闭时回退旧推荐路径')
assert.equal(formatAffiliateCatalogMonthSales(null), undefined, '未知月销量不展示文案')
assert.equal(formatAffiliateCatalogMonthSales(0), '月销 0', '真实的零销量仍然可见')
assert.equal(formatAffiliateCatalogMonthSales(1250), '月销 1250')
assert.equal(formatAffiliateCatalogMonthSales(-1), undefined)
assert.equal(formatAffiliateCatalogMonthSales(Number.NaN), undefined)
assert.equal(hasMoreAffiliateCatalogPages(1, 20, 21), true)
assert.equal(hasMoreAffiliateCatalogPages(2, 20, 21), false)
assert.deepEqual(
  getAffiliateCatalogSnapshotRestart(2, 'daily', 'tissues', 409, 'affiliate_catalog_snapshot_changed'),
  { page: 1, group: 'daily', tag: 'tissues' },
)
assert.equal(
  getAffiliateCatalogSnapshotRestart(2, 'daily', 'tissues', 409, 'request_conflict'),
  null,
  '其他409不能被当成商品库快照冲突自动重放',
)
assert.equal(getAffiliateCatalogSnapshotRestart(1, 'daily', 'tissues', 409, 'affiliate_catalog_snapshot_changed'), null)

const tags: AffiliateCatalogTag[] = [
  { key: 'pocket_tissues', name: '袖珍纸巾（后台）', count: 4 },
  { key: 'unknown_tag', name: '未配置分类', count: 99 },
  { key: 'toothpaste', name: '牙膏（后台）', count: 8 },
  { key: 'sanitary_pads', name: '卫生巾（后台）', count: 7 },
]
const sortedTags = sortAffiliateCatalogDailyTags(tags)
assert.deepEqual(sortedTags.map((tag) => tag.key), ['sanitary_pads', 'toothpaste', 'pocket_tissues'])
assert.equal(sortedTags[0].name, '卫生巾（后台）', '日用标签显示后端权威名称')
assert.equal(sortedTags[0].count, 7, '日用标签显示后端权威数量')

const catalogItem = (goodsId: string, monthSales: number | null): AffiliateCatalogItem => ({
  goods: {
    goods_id: goodsId,
    title: `商品 ${goodsId}`,
    availability: 'valid',
    coupon_status: 'none',
  },
  month_sales: monthSales,
})
const deduplicated = appendUniqueAffiliateCatalogItems(
  [catalogItem('opaque-001', 8), catalogItem('001', null)],
  [catalogItem('opaque-001', 10)],
)
assert.deepEqual(deduplicated.map((item) => item.goods.goods_id), ['opaque-001', '001'])
assert.equal(deduplicated[0].month_sales, 10, '重复商品采用最新数据但保持首次位置')
assert.equal(deduplicated[1].month_sales, null, '未知销量保持未知')

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((complete) => { resolve = complete })
  return { promise, resolve }
}

async function verifyRequestCoordination() {
  const coordinator = new AffiliateCatalogRequestCoordinator()
  coordinator.setScope(true, true)
  const commits: string[] = []
  const oldResponse = deferred<string>()
  const newResponse = deferred<string>()
  const oldIdentity = coordinator.begin('food', undefined, 1)
  const oldTask = oldResponse.promise.then((value) => {
    if (coordinator.isCurrent(oldIdentity)) commits.push(value)
  })
  const newIdentity = coordinator.begin('daily', 'tissues', 1)
  const newTask = newResponse.promise.then((value) => {
    if (coordinator.isCurrent(newIdentity)) commits.push(value)
  })
  newResponse.resolve('日用纸巾最新响应')
  await newTask
  oldResponse.resolve('美食旧响应')
  await oldTask
  assert.deepEqual(commits, ['日用纸巾最新响应'], '切换主分类和日用子类后旧响应不能覆盖列表')

  const firstPage = coordinator.begin('daily', 'tissues', 1)
  const nextPage = coordinator.begin('daily', 'tissues', 2)
  assert.equal(coordinator.isCurrent(firstPage), false, '下一页请求会淘汰过期首屏响应')
  assert.equal(coordinator.isCurrent(nextPage), true)
  coordinator.setScope(false, true)
  assert.equal(coordinator.isCurrent(nextPage), false, '页面隐藏后请求不再提交副作用')
  coordinator.setScope(true, true)
  const enabledRequest = coordinator.begin('food', undefined, 1)
  coordinator.setScope(true, false)
  assert.equal(coordinator.isCurrent(enabledRequest), false, '好物能力关闭后请求不再提交副作用')
}

async function verifyAutoLoadMoreRetryGuards() {
  const state = {
    phase: 'ready' as 'ready' | 'loading',
    page: 1,
    pageSize: 20,
    total: 60,
    snapshotId: 'snapshot-current',
    error: '',
    loadMoreError: '',
    loadingMore: false,
  }
  const scope = {
    active: true,
    capabilityEnabled: true,
    group: 'daily' as const,
    tag: 'tissues',
  }
  const requests: Array<[number, string | undefined, string | undefined, boolean, string | undefined]> = []
  const controls = createAffiliateCatalogLoadMoreHandlers(
    () => state,
    () => scope,
    (page, group, tag, reset, snapshotId) => {
      requests.push([page, group, tag, reset, snapshotId])
      state.phase = 'loading'
      state.loadingMore = true
      state.loadMoreError = ''
    },
  )

  controls.loadMore()
  controls.loadMore()
  assert.equal(requests.length, 1, '连续触底只发送一个分页请求')
  assert.deepEqual(requests[0], [2, 'daily', 'tissues', false, 'snapshot-current'])

  state.phase = 'ready'
  state.loadingMore = false
  state.loadMoreError = '网络错误'
  controls.loadMore()
  assert.equal(requests.length, 1, '分页失败后再次触底不会自动重试')

  state.loadMoreError = ''
  state.error = '首屏错误'
  controls.loadMore()
  assert.equal(requests.length, 1, '存在页面错误时不会因触底发起下一页请求')

  state.error = ''
  state.loadMoreError = '网络错误'
  controls.retryMore()
  assert.equal(requests.length, 2, '明确点击重试仍可发起下一页请求')
  assert.deepEqual(requests[1], [2, 'daily', 'tissues', false, 'snapshot-current'])

  scope.active = false
  controls.loadMore()
  assert.equal(requests.length, 2, '页面隐藏后触底不继续发送请求')
  scope.active = true
  scope.capabilityEnabled = false
  controls.retryMore()
  assert.equal(requests.length, 2, '好物能力关闭后重试不发送请求')
}

async function verifyCatalogApiQuery() {
  const originalLoad = (Module as any)._load
  let captured: { path: string; query: Record<string, unknown> } | undefined
  ;(Module as any)._load = function (request: string, parent: { filename?: string }, isMain: boolean) {
    if (request === './client' && parent?.filename?.endsWith('/src/api/affiliate.ts')) {
      return {
        apiRequest: async (options: { path: string; query: Record<string, unknown> }) => {
          captured = options
          return {
            enabled: true,
            items: [],
            groups: [],
            tags: [],
            total: 0,
            page: 1,
            page_size: 50,
            snapshot_id: 'snapshot-2',
          }
        },
      }
    }
    return originalLoad.call(this, request, parent, isMain)
  }

  try {
    const { listAffiliateCatalog } = require('../src/api/affiliate') as typeof import('../src/api/affiliate')
    await listAffiliateCatalog({ group: 'daily', tag: 'tissues', page: 2, page_size: 80, snapshot_id: 'snapshot-1' })
    assert.deepEqual(captured, {
      path: '/api/v1/affiliate/catalog',
      query: {
        group: 'daily',
        tag: 'tissues',
        page: 2,
        page_size: 50,
        snapshot_id: 'snapshot-1',
      },
    })
    await listAffiliateCatalog({ page: 1 })
    assert.deepEqual(captured?.query, {
      group: undefined,
      tag: undefined,
      page: 1,
      page_size: 20,
      snapshot_id: undefined,
    }, '综合列表省略分类筛选并使用默认分页')
  } finally {
    ;(Module as any)._load = originalLoad
  }
}

const homeSource = readFileSync('src/pages/goods/index.tsx', 'utf8')
const sectionSource = readFileSync('src/features/affiliate/catalog/catalog-section.tsx', 'utf8')
assert.match(homeSource, /if \(!result\.enabled\) \{\s*handleCatalogDisabled\(\)/u, '只有商品库明确关闭时切换旧推荐路径')
assert.match(homeSource, /setCatalogMode\('error'\)/u, '请求错误保留错误状态，不当作接口关闭')
assert.match(homeSource, /catalogMode === 'enabled'[\s\S]*?catalogLoadMoreRef\.current\?\.\(\)/u, '商品库启用时页面触底会触发商品库自动翻页')
assert.match(homeSource, /catalogMode !== 'disabled'.*shouldShowAffiliateManualFallback/u, '旧推荐翻页仍仅在商品库明确关闭后运行')
assert.match(sectionSource, /onLoadMoreReady\(active && capabilityEnabled \? loadMore : null\)/u, '商品库向页面注册当前筛选的自动翻页处理器')
assert.match(sectionSource, /return \(\) => onLoadMoreReady\(null\)/u, '页面隐藏或商品库卸载时注销自动翻页处理器')
assert.match(sectionSource, /createAffiliateCatalogLoadMoreHandlers/u, '商品库组件使用可回归验证的自动翻页和手动重试回调')
assert.doesNotMatch(sectionSource, /ariaRole='button' onClick=\{loadMore\}>加载更多商品/u, '普通翻页由触底自动触发，不要求用户再点加载按钮')
assert.match(sectionSource, /上拉加载更多商品/u, '还有商品时提示用户继续上拉')
assert.match(sectionSource, /salesLabel=\{formatAffiliateCatalogMonthSales\(item\.month_sales\)\}/u, '卡片销量来自真实月销量字段')
assert.doesNotMatch(sectionSource, /2小时热销|2小时售/u, '商品库不混入两小时销量标签')
assert.match(sectionSource, /cacheAffiliateGoods\(item\.goods\)/u, '详情页使用商品库商品快照')
assert.match(sectionSource, /goods_id=\$\{encodeURIComponent\(item\.goods\.goods_id\)\}/u, '详情路由按不透明商品标识编码')
assert.match(sectionSource, /tag\.name[\s\S]*?tag\.count/u, '日用子类显示后端提供的标签名和数量')

void Promise.all([verifyRequestCoordination(), verifyAutoLoadMoreRetryGuards(), verifyCatalogApiQuery()])
  .then(() => console.log('affiliate catalog groups, tags, snapshot, stale requests and API query: ok'))
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
    process.exitCode = 1
  })
