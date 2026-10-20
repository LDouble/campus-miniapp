import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import ts = require('typescript')

type Product = { id: number }
type Page = { items: Product[]; page: number; total: number }
const source = ts.createSourceFile('home.tsx', readFileSync('src/pages/goods/index.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const variable = (name: string) => {
  let found: ts.VariableDeclaration | undefined
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) found = node
    if (!found) node.forEachChild(visit)
  }
  visit(source)
  assert.ok(found?.initializer, `生产页面应包含 ${name}`)
  return found!.initializer!.getText(source)
}
const hook = (name: string) => {
  let found: ts.CallExpression | undefined
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(source) === name) found = node
    if (!found) node.forEachChild(visit)
  }
  visit(source)
  assert.ok(found, `生产页面应注册 ${name}`)
  return found!.arguments[0].getText(source)
}
const executable = ts.transpileModule([
  `const appendUniqueProducts = ${variable('appendUniqueProducts')}`,
  `const loadProducts = ${variable('loadProducts')}`,
  `const reachBottom = ${hook('useReachBottom')}`,
  `const pullDown = ${hook('usePullDownRefresh')}`,
  // 翻页失败的可见重试入口和实际触底流程一起验证。
  source.text.includes('const retryMore =') ? `const retryMore = ${variable('retryMore')}` : 'const retryMore = undefined',
  'return { loadProducts, reachBottom, pullDown, retryMore }',
].join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } }).outputText

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const flush = async () => { for (let i = 0; i < 10; i += 1) await Promise.resolve() }
const harness = (rankingsEnabled: boolean | null = false) => {
  const state = { products: [{ id: 1 }] as Product[], page: 1, total: 60, loading: false, loadingMore: false, loaded: true, error: '', loadMoreError: '', rankingRefreshToken: 0, rankingsEnabled }
  const refs = { loadingRef: { current: false }, requestRevision: { current: 0 }, loadedRef: { current: true } }
  const requests: { page: number; result: ReturnType<typeof deferred<Page>> }[] = []
  let stopped = 0
  const render = () => {
    const env = {
      ...state, ...refs,
      categoryId: undefined, topicId: undefined, PAGE_SIZE: 20,
      capabilities: { enabled: true },
      getAffiliateCapabilitySnapshot: () => ({ capabilities: { enabled: true } }),
      refreshAffiliateCapabilities: async () => ({ capabilities: { enabled: true } }),
      setRankingRefreshToken: (value: number | ((current: number) => number)) => { state.rankingRefreshToken = typeof value === 'function' ? value(state.rankingRefreshToken) : value },
      setRankingsEnabled: (value: boolean | null) => { state.rankingsEnabled = value },
      shouldShowAffiliateManualFallback: (enabled: boolean | null) => enabled === false,
      loadShortcuts: () => undefined,
      loadTaxonomies: async () => undefined,
      Taro: { stopPullDownRefresh: () => { stopped += 1 } },
      useCallback: (callback: unknown) => callback,
      listAffiliateProducts: (params: { page: number }) => {
        const result = deferred<Page>()
        requests.push({ page: params.page, result })
        return result.promise
      },
      setProducts: (value: Product[] | ((current: Product[]) => Product[])) => { state.products = typeof value === 'function' ? value(state.products) : value },
      setPage: (value: number) => { state.page = value },
      setTotal: (value: number) => { state.total = value },
      setLoading: (value: boolean) => { state.loading = value },
      setLoadingMore: (value: boolean) => { state.loadingMore = value },
      setLoaded: (value: boolean) => { state.loaded = value },
      setError: (value: string) => { state.error = value },
      setLoadMoreError: (value: string) => { state.loadMoreError = value },
    }
    return new Function(...Object.keys(env), executable)(...Object.values(env)) as {
      loadProducts: (page: number) => Promise<void>
      reachBottom: () => void
      pullDown: () => void
      retryMore?: () => void
    }
  }
  return { state, refs, requests, render, get stopped() { return stopped } }
}

export async function runAffiliateHomePaginationSmoke() {
  const refreshing = harness()
  const older = refreshing.render().loadProducts(2)
  refreshing.render().pullDown()
  await flush()
  assert.deepEqual(refreshing.requests.map((request) => request.page), [2, 1], '下拉必须新取第一页，不能被进行中的翻页跳过')
  assert.equal(refreshing.stopped, 0, '刷新完成前不能结束刷新提示')
  refreshing.requests[0].result.resolve({ items: [{ id: 2 }], page: 2, total: 60 })
  await older
  assert.deepEqual(refreshing.state.products, [{ id: 1 }], '已被刷新取代的旧页不能追加')
  assert.equal(refreshing.refs.loadingRef.current, true, '旧页finally不能释放当前刷新锁')
  refreshing.requests[1].result.resolve({ items: [{ id: 10 }], page: 1, total: 60 })
  await flush()
  assert.deepEqual(refreshing.state.products, [{ id: 10 }])
  assert.equal(refreshing.stopped, 1)

  const failed = harness()
  const pending = failed.render().loadProducts(2)
  failed.requests[0].result.reject(new Error('第二页网络失败'))
  await pending
  assert.equal(failed.state.loadMoreError, '第二页网络失败', '翻页失败必须保留可见错误，不伪装成继续加载')
  assert.deepEqual(failed.state.products, [{ id: 1 }], '翻页失败保持已有内容')
  failed.render().reachBottom()
  assert.equal(failed.requests.length, 1, '失败后触底不能自动反复重试')
  assert.equal(typeof failed.render().retryMore, 'function', '失败必须提供明确重试')
  failed.render().retryMore!()
  assert.deepEqual(failed.requests.map((request) => request.page), [2, 2], '明确重试应继续失败页')
  failed.requests[1].result.resolve({ items: [{ id: 2 }], page: 2, total: 60 })
  await flush()
  assert.deepEqual(failed.state.products, [{ id: 1 }, { id: 2 }])
  assert.equal(failed.state.loadMoreError, '')

  const firstFailure = harness()
  const first = firstFailure.render().loadProducts(1)
  firstFailure.requests[0].result.reject(new Error('刷新失败'))
  await first
  firstFailure.render().reachBottom()
  assert.equal(firstFailure.requests.length, 1, '第一页失败时不得继续追加旧查询下一页')

  const rankingEnabled = harness(true)
  rankingEnabled.render().reachBottom()
  assert.equal(rankingEnabled.requests.length, 0, '自动榜单启用时触底不再请求隐藏的人工列表')
  const rankingUnknown = harness(null)
  rankingUnknown.render().reachBottom()
  assert.equal(rankingUnknown.requests.length, 0, '榜单开关未知或请求失败时不继续请求隐藏的人工列表')
  console.log('affiliate home refresh and pagination: ok')
}
