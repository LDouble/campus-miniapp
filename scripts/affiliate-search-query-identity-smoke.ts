import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import ts = require('typescript')
import { canUseAffiliateCapability } from '../src/features/affiliate/capability-policy'
import { validateAffiliateSearchFilter } from '../src/features/affiliate/search-filters'
import { shouldContinueAffiliateSearch } from '../src/features/affiliate/search-pagination'

type SearchItem = { goods_id: string; title: string }
type SearchFilters = Record<string, unknown>
type SearchQuery = { keyword: string; filters: SearchFilters }
type SearchResponse = { page: number; page_size: number; total: number; items: SearchItem[] }
type SearchRequest = { keyword: string; page: number; filters: SearchFilters }

const source = readFileSync('src/pages/goods/search.tsx', 'utf8')
const sourceFile = ts.createSourceFile('search.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

const findVariable = (root: ts.Node, name: string): ts.VariableDeclaration => {
  let found: ts.VariableDeclaration | undefined
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.name.text === name) {
      found = node
      return
    }
    if (!found) node.forEachChild(visit)
  }
  visit(root)
  assert.ok(found, `应在生产搜索页找到 ${name} 声明`)
  return found!
}

const component = sourceFile.statements.find((statement) => (
  ts.isFunctionDeclaration(statement) && statement.name?.text === 'AffiliateSearchPage'
))
assert.ok(component, '应在生产搜索页找到 AffiliateSearchPage')

const extractHandler = (name: string): string => {
  const declaration = findVariable(component!, name)
  assert.ok(declaration.initializer, `${name} 应有实现`)
  const initializer = declaration.initializer!
  if (name === 'runSearch') {
    assert.ok(ts.isCallExpression(initializer), 'runSearch 应由 React callback 承载')
    const callback = initializer.arguments[0]
    assert.ok(callback && ts.isArrowFunction(callback), '应能提取 runSearch 的真实 callback')
    return callback.getText(sourceFile)
  }
  assert.ok(ts.isArrowFunction(initializer), `${name} 应由真实 arrow handler 承载`)
  return initializer.getText(sourceFile)
}

const mergeGoodsDeclaration = findVariable(sourceFile, 'mergeGoods')
assert.ok(mergeGoodsDeclaration.initializer, '应在生产搜索页找到商品合并实现')
const handlerNames = ['runSearch', 'loadNextPage', 'handleSearch', 'retrySearch', 'applySort', 'applyFilters']
const extractedSource = [
  `const mergeGoods = ${mergeGoodsDeclaration.initializer!.getText(sourceFile)}`,
  ...handlerNames.map((name) => `const ${name} = ${extractHandler(name)}`),
  `return { ${handlerNames.join(', ')} }`,
].join('\n')
const extractedJavaScript = ts.transpileModule(extractedSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
  reportDiagnostics: true,
})
const extractionErrors = (extractedJavaScript.diagnostics || []).filter((diagnostic) => (
  diagnostic.category === ts.DiagnosticCategory.Error
))
assert.equal(extractionErrors.length, 0, '应能编译 AST 提取的生产 handler')

const enabledCapabilities = {
  enabled: true,
  search_enabled: true,
  resolve_enabled: true,
  convert_enabled: true,
}

const createHarness = (options: {
  draftKeyword: string
  submittedKeyword: string
  currentItems: SearchItem[]
  page?: number
  total?: number
  hasMore?: boolean
  response?: SearchResponse
  request?: (request: SearchRequest, index: number) => Promise<SearchResponse>
  draftHasCoupon?: boolean
  draftCategoryId?: number
  draftMinPrice?: string
  draftMaxPrice?: string
}) => {
  const submittedQuery = {
    keyword: options.submittedKeyword,
    filters: { sort: 'comprehensive' },
  }
  const state = {
    keyword: options.draftKeyword,
    submittedQuery: submittedQuery as SearchQuery | null,
    searchResult: {
      query: submittedQuery as SearchQuery | null,
      items: options.currentItems,
      page: options.page ?? 1,
      total: options.total ?? 40,
      hasMore: options.hasMore ?? true,
    },
    loading: false,
    loadingMore: false,
    loadError: '',
    loadMoreError: false,
    searchFilters: { sort: 'comprehensive' } as SearchFilters,
    filterMessage: '',
    filterExpanded: false,
    draftHasCoupon: options.draftHasCoupon ?? false,
    draftCategoryId: options.draftCategoryId,
    draftMinPrice: options.draftMinPrice ?? '',
    draftMaxPrice: options.draftMaxPrice ?? '',
  }
  const refs = {
    searchRevision: { current: 0 },
    loadingRef: { current: false },
    submittedQueryRef: { current: submittedQuery as SearchQuery | null },
    runSearchRef: { current: undefined as ((...args: any[]) => unknown) | undefined },
    initialSearchPending: { current: false },
    resolveRevision: { current: 0 },
    resolveInFlightRef: { current: false },
  }
  const requests: SearchRequest[] = []
  const defaultResponse = options.response || {
    page: 2,
    page_size: 20,
    total: 40,
    items: [{ goods_id: 'paper-2', title: '纸巾第二页商品' }],
  }
  const set = <K extends keyof typeof state>(
    key: K,
    value: typeof state[K] | ((current: typeof state[K]) => typeof state[K]),
  ) => {
    const next = typeof value === 'function'
      ? (value as (current: typeof state[K]) => typeof state[K])(state[key])
      : value
    state[key] = next
  }
  const hasCurrentResults = () => (
    state.submittedQuery !== null && state.searchResult.query === state.submittedQuery
  )
  const render = () => {
    const active = hasCurrentResults()
    const env = {
      keyword: state.keyword,
      submittedQuery: state.submittedQuery,
      page: active ? state.searchResult.page : 0,
      hasMore: active && state.searchResult.hasMore,
      searched: state.submittedQuery !== null,
      hasCurrentResults: active,
      loadMoreError: state.loadMoreError,
      loadingRef: refs.loadingRef,
      searchRevision: refs.searchRevision,
      submittedQueryRef: refs.submittedQueryRef,
      runSearchRef: refs.runSearchRef,
      initialSearchPending: refs.initialSearchPending,
      resolveRevision: refs.resolveRevision,
      resolveInFlightRef: refs.resolveInFlightRef,
      searchFilters: state.searchFilters,
      draftHasCoupon: state.draftHasCoupon,
      draftCategoryId: state.draftCategoryId,
      draftMinPrice: state.draftMinPrice,
      draftMaxPrice: state.draftMaxPrice,
      capabilities: enabledCapabilities,
      useCallback: (callback: (...args: any[]) => unknown) => callback,
      Taro: { showToast: () => undefined },
      refreshAffiliateCapabilities: async () => ({ capabilities: enabledCapabilities }),
      getAffiliateCapabilitySnapshot: () => ({ capabilities: enabledCapabilities }),
      canUseAffiliateCapability,
      shouldContinueAffiliateSearch,
      validateAffiliateSearchFilter,
      searchAffiliateGoods: async (query: string | SearchQuery, page: number, filters?: SearchFilters) => {
        const normalizedQuery = typeof query === 'string'
          ? { keyword: query, filters: filters || {} }
          : query
        const request = { keyword: normalizedQuery.keyword, page, filters: normalizedQuery.filters }
        requests.push(request)
        if (options.request) return options.request(request, requests.length)
        return defaultResponse
      },
      setSubmittedQuery: (value: SearchQuery | null) => { state.submittedQuery = value },
      setSearchResult: (value: typeof state.searchResult | ((current: typeof state.searchResult) => typeof state.searchResult)) => (
        set('searchResult', value)
      ),
      setLoading: (value: boolean) => { state.loading = value },
      setLoadingMore: (value: boolean) => { state.loadingMore = value },
      setLoadError: (value: string) => { state.loadError = value },
      setLoadMoreError: (value: boolean) => { state.loadMoreError = value },
      setKeyword: (value: string) => { state.keyword = value },
      setSearchFilters: (value: SearchFilters) => { state.searchFilters = value },
      setFilterMessage: (value: string) => { state.filterMessage = value },
      setFilterExpanded: (value: boolean) => { state.filterExpanded = value },
      setResolveLoading: () => undefined,
      setResolvedGoods: () => undefined,
      setResolveMessage: () => undefined,
    }
    const keys = Object.keys(env)
    const factory = new Function(...keys, extractedJavaScript.outputText) as (...values: unknown[]) => Record<string, (...args: any[]) => any>
    const handlers = factory(...keys.map((key) => (env as Record<string, unknown>)[key]))
    refs.runSearchRef.current = handlers.runSearch
    return handlers
  }
  return { state, refs, requests, render }
}

const waitForAsyncHandlers = async () => new Promise<void>((resolve) => setTimeout(resolve, 0))
const pageResponse = (page: number, items: SearchItem[], total = 40): SearchResponse => ({
  page,
  page_size: 20,
  total,
  items,
})

const verifyDraftEditsAndRetryStayOnSubmittedQuery = async () => {
  const harness = createHarness({
    draftKeyword: '杯子',
    submittedKeyword: '纸巾',
    currentItems: [{ goods_id: 'paper-1', title: '纸巾第一页商品' }],
    request: async (_request, index) => {
      if (index === 1) throw new Error('模拟第二页失败')
      return pageResponse(2, [{ goods_id: 'paper-2', title: '纸巾第二页商品' }])
    },
  })

  harness.render().loadNextPage()
  await waitForAsyncHandlers()
  assert.equal(harness.state.loadMoreError, true, '第二页失败应保留可重试状态')
  assert.deepEqual(harness.state.searchResult.items.map(({ goods_id }) => goods_id), ['paper-1'])

  harness.render().loadNextPage(true)
  await waitForAsyncHandlers()
  assert.deepEqual(harness.requests, [
    { keyword: '纸巾', page: 2, filters: { sort: 'comprehensive' } },
    { keyword: '纸巾', page: 2, filters: { sort: 'comprehensive' } },
  ], '编辑“杯子”后翻页和失败重试都必须请求已提交的“纸巾”第二页')
  assert.deepEqual(
    harness.state.searchResult.items.map(({ goods_id }) => goods_id),
    ['paper-1', 'paper-2'],
    '重试结果应合并到同一提交查询，并按商品 id 去重',
  )
}

const verifyClearedDraftDoesNotBlockSubmittedPagination = async () => {
  const harness = createHarness({
    draftKeyword: '',
    submittedKeyword: '纸巾',
    currentItems: [{ goods_id: 'paper-1', title: '纸巾第一页商品' }],
  })
  harness.render().loadNextPage()
  await waitForAsyncHandlers()
  assert.deepEqual(harness.requests, [
    { keyword: '纸巾', page: 2, filters: { sort: 'comprehensive' } },
  ], '清空输入只清空草稿，不能拦截已提交查询的分页')
}

const verifySubmittingNewKeywordReplacesResults = async () => {
  const harness = createHarness({
    draftKeyword: '杯子',
    submittedKeyword: '纸巾',
    currentItems: [{ goods_id: 'paper-1', title: '纸巾第一页商品' }],
    response: pageResponse(1, [{ goods_id: 'cup-1', title: '杯子第一页商品' }], 1),
  })
  harness.render().handleSearch()
  await waitForAsyncHandlers()
  assert.deepEqual(harness.requests, [
    { keyword: '杯子', page: 1, filters: { sort: 'comprehensive' } },
  ], '只有明确提交新词时才应以新词请求第一页')
  assert.equal(harness.state.searchResult.query?.keyword, '杯子')
  assert.deepEqual(harness.state.searchResult.items.map(({ goods_id }) => goods_id), ['cup-1'])
  assert.equal(harness.state.searchResult.total, 1)
}

const verifyFirstPageRetryStaysOnSubmittedQuery = async () => {
  const harness = createHarness({
    draftKeyword: '纸巾',
    submittedKeyword: '旧查询',
    currentItems: [{ goods_id: 'old-1', title: '旧查询商品' }],
    request: async (_request, index) => {
      if (index === 1) throw new Error('模拟第一页失败')
      return pageResponse(1, [{ goods_id: 'paper-1', title: '纸巾第一页商品' }], 12)
    },
  })
  harness.render().handleSearch()
  await waitForAsyncHandlers()
  assert.match(harness.state.loadError, /模拟第一页失败/u)

  harness.state.keyword = '杯子'
  harness.render().retrySearch()
  await waitForAsyncHandlers()
  assert.deepEqual(harness.requests, [
    { keyword: '纸巾', page: 1, filters: { sort: 'comprehensive' } },
    { keyword: '纸巾', page: 1, filters: { sort: 'comprehensive' } },
  ], '第一页失败后编辑草稿，“重新搜索”仍应重试已提交的查询')
  assert.deepEqual(harness.state.searchResult.items.map(({ goods_id }) => goods_id), ['paper-1'])
  assert.equal(harness.state.searchResult.total, 12)
}

const verifySortAndFiltersUseSubmittedKeyword = async () => {
  const sorted = createHarness({
    draftKeyword: '杯子',
    submittedKeyword: '纸巾',
    currentItems: [{ goods_id: 'paper-1', title: '纸巾第一页商品' }],
    response: pageResponse(1, [{ goods_id: 'sorted-paper', title: '纸巾销量排序商品' }]),
  })
  sorted.render().applySort('sales')
  await waitForAsyncHandlers()
  assert.deepEqual(sorted.requests, [
    { keyword: '纸巾', page: 1, filters: { sort: 'sales' } },
  ], '编辑草稿后更改排序仍应针对已提交关键词')

  const filtered = createHarness({
    draftKeyword: '杯子',
    submittedKeyword: '纸巾',
    currentItems: [{ goods_id: 'paper-1', title: '纸巾第一页商品' }],
    draftHasCoupon: true,
    draftCategoryId: 4,
    draftMinPrice: '10',
    draftMaxPrice: '20',
    response: pageResponse(1, [{ goods_id: 'filtered-paper', title: '纸巾筛选商品' }]),
  })
  filtered.render().applyFilters()
  await waitForAsyncHandlers()
  assert.deepEqual(filtered.requests, [
    {
      keyword: '纸巾',
      page: 1,
      filters: {
        category_id: 4,
        has_coupon: true,
        min_price: '10',
        max_price: '20',
        sort: 'comprehensive',
      },
    },
  ], '编辑草稿后应用筛选仍应针对已提交关键词，并将过滤条件绑定到新查询')
}

const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

const verifyOldResponseCannotReplaceNewQuery = async () => {
  const oldPageResponse = deferred<SearchResponse>()
  const harness = createHarness({
    draftKeyword: '纸巾',
    submittedKeyword: '纸巾',
    currentItems: [{ goods_id: 'paper-1', title: '纸巾第一页商品' }],
    request: async (request) => (
      request.keyword === '纸巾' ? oldPageResponse.promise : pageResponse(1, [{ goods_id: 'cup-1', title: '杯子第一页商品' }], 1)
    ),
  })

  harness.render().loadNextPage()
  await waitForAsyncHandlers()
  assert.equal(harness.requests.length, 1, '旧查询第二页请求应已发出并等待响应')
  harness.state.keyword = '杯子'
  harness.render().handleSearch()
  await waitForAsyncHandlers()
  assert.equal(harness.state.searchResult.query?.keyword, '杯子')
  assert.deepEqual(harness.state.searchResult.items.map(({ goods_id }) => goods_id), ['cup-1'])

  oldPageResponse.resolve(pageResponse(2, [{ goods_id: 'paper-2', title: '过期纸巾第二页商品' }]))
  await waitForAsyncHandlers()
  assert.equal(harness.state.searchResult.query?.keyword, '杯子', '旧请求不能替换当前查询身份')
  assert.deepEqual(harness.state.searchResult.items.map(({ goods_id }) => goods_id), ['cup-1'], '旧查询结果不能混入新查询列表')
  assert.equal(harness.state.searchResult.total, 1, '旧响应不能覆盖新查询的 total')
}

export const runAffiliateSearchQueryIdentitySmoke = async () => {
  await verifyDraftEditsAndRetryStayOnSubmittedQuery()
  await verifyClearedDraftDoesNotBlockSubmittedPagination()
  await verifySubmittingNewKeywordReplacesResults()
  await verifyFirstPageRetryStaysOnSubmittedQuery()
  await verifySortAndFiltersUseSubmittedKeyword()
  await verifyOldResponseCannotReplaceNewQuery()
}

if (require.main === module) {
  void runAffiliateSearchQueryIdentitySmoke().then(() => {
    console.log('affiliate search query identity smoke passed')
  }).catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
