import { strict as assert } from 'node:assert'
import {
  canLoadMoreRankingItems,
  createRankingPageRequestGate,
  createRankingPagination,
  mergeRankingPage,
  requestRankingPage,
} from '../src/features/academic-ranking/pagination'

async function verifyPaginationBehavior() {
  const empty = createRankingPagination<{ id: number; name: string }>(2)
  assert.equal(canLoadMoreRankingItems(empty), false, '未读取第一页前不能加载更多')

  const firstPage = mergeRankingPage(empty, {
    items: [{ id: 1, name: '组一' }, { id: 2, name: '组二' }],
    page: 1,
    page_size: 2,
    total: 5,
  }, true)
  assert.deepEqual(firstPage.items.map((item) => item.id), [1, 2])
  assert.equal(firstPage.total, 5, '分页状态必须保留服务端总数')
  assert.equal(canLoadMoreRankingItems(firstPage), true)

  const secondPage = mergeRankingPage(firstPage, {
    items: [{ id: 2, name: '重复组二' }, { id: 3, name: '组三' }],
    page: 2,
    page_size: 2,
    total: 5,
  })
  assert.deepEqual(secondPage.items.map((item) => item.id), [1, 2, 3], '追加页不能重复显示跨页重复记录')
  assert.equal(canLoadMoreRankingItems(secondPage), true)

  const lastPage = mergeRankingPage(secondPage, {
    items: [{ id: 4, name: '组四' }, { id: 5, name: '组五' }],
    page: 3,
    page_size: 2,
    total: 5,
  })
  assert.deepEqual(lastPage.items.map((item) => item.id), [1, 2, 3, 4, 5])
  assert.equal(canLoadMoreRankingItems(lastPage), false, '已到服务端总数时应停止分页')

  const refreshed = mergeRankingPage(lastPage, {
    items: [{ id: 6, name: '新组' }],
    page: 1,
    page_size: 2,
    total: 1,
  }, true)
  assert.deepEqual(refreshed.items.map((item) => item.id), [6], '刷新第一页应丢弃旧页并重新计数')

  const failed = await requestRankingPage(lastPage, async () => { throw new Error('offline') })
  assert.equal(failed.ok, false)
  if (!failed.ok) {
    assert.strictEqual(failed.state, lastPage, '请求失败必须原样保留已加载列表')
    assert.equal(failed.state.items.length, 5)
  }

  const groupsGate = createRankingPageRequestGate()
  const reportsGate = createRankingPageRequestGate()
  const groupRequestId = groupsGate.begin()
  assert.notEqual(groupRequestId, null)
  assert.equal(groupsGate.begin(), null, '同一列表的并发加载请求必须被挡住')
  const reportRequestId = reportsGate.begin()
  assert.notEqual(reportRequestId, null, '另一列表不应被排名组请求锁住')
  assert.equal(groupsGate.finish(groupRequestId!), true)
  assert.equal(reportsGate.isActive(reportRequestId!), true, '完成排名组请求不能结束报告请求')
  reportsGate.cancel()
  assert.equal(reportsGate.isActive(reportRequestId!), false, '刷新后旧的加载更多请求必须失效')
  assert.equal(reportsGate.finish(reportRequestId!), false, '已取消请求不能重新释放门闩')
}

async function main() {
  await verifyPaginationBehavior()
  const calls: Array<{ path: string; query?: Record<string, number> }> = []
  const groupPage = {
    items: [{ id: 21, name: '第二页排名组' }],
    page: 2,
    page_size: 20,
    total: 31,
  }
  const reportPage = {
    items: [{ id: 42, group_name: '第二页报告' }],
    page: 2,
    page_size: 20,
    total: 25,
  }

  const clientModuleId = require.resolve('../src/api/client')
  const originalClientModule = require.cache[clientModuleId]
  require.cache[clientModuleId] = {
    id: clientModuleId,
    filename: clientModuleId,
    loaded: true,
    exports: {
      apiRequest: (request: { path: string; query?: Record<string, number> }) => {
        calls.push(request)
        return Promise.resolve(request.path.endsWith('/groups') ? groupPage : reportPage)
      },
      createIdempotencyKey: () => 'pagination-smoke',
    },
    children: [],
    paths: [],
  } as NodeModule

  const rankingModuleId = require.resolve('../src/api/academic-ranking')
  const originalRankingModule = require.cache[rankingModuleId]
  delete require.cache[rankingModuleId]

  try {
    const {
      listAcademicRankingGroups,
      listAcademicRankingReports,
    }: typeof import('../src/api/academic-ranking') = require(rankingModuleId)

    const [groups, reports] = await Promise.all([
      listAcademicRankingGroups(2, 20),
      listAcademicRankingReports(2, 20),
    ])

    assert.deepEqual(groups, groupPage, 'group API must preserve page metadata and items')
    assert.deepEqual(reports, reportPage, 'report API must preserve page metadata and items')
    assert.deepEqual(calls.map(({ path, query }) => ({ path, query })), [
      { path: '/api/v1/academic/rankings/groups', query: { page: 2, page_size: 20 } },
      { path: '/api/v1/academic/rankings/reports', query: { page: 2, page_size: 20 } },
    ], 'both list APIs must request their own page and page size')

    process.stdout.write('academic ranking pagination API smoke: ok\n')
  } finally {
    if (originalRankingModule) require.cache[rankingModuleId] = originalRankingModule
    else delete require.cache[rankingModuleId]
    if (originalClientModule) require.cache[clientModuleId] = originalClientModule
    else delete require.cache[clientModuleId]
  }
}

void main()
