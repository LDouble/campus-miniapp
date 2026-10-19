import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import ts = require('typescript')
import { canUseAffiliateCapability } from '../src/features/affiliate/capability-policy'
import { dispatchAffiliateSearchInput } from '../src/features/affiliate/search-input-policy'
import { validateAffiliateSearchFilter } from '../src/features/affiliate/search-filters'
import { shouldContinueAffiliateSearch } from '../src/features/affiliate/search-pagination'

type SearchItem = {
  goods_id: string
  title: string
  resolution_token?: string | null
  requires_resolution_token?: boolean
}
type SearchFilters = Record<string, unknown>
type SearchQuery = { keyword: string; filters: SearchFilters }
type SearchResponse = { page: number; page_size: number; total: number; items: SearchItem[] }
type SearchRequest = { keyword: string; page: number; filters: SearchFilters }
type ResolveResponse = { status: string; product?: SearchItem; resolution_token?: string | null }

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

const hideHook = (component as ts.FunctionDeclaration).body!.statements.find((statement) => (
  ts.isExpressionStatement(statement)
  && ts.isCallExpression(statement.expression)
  && ts.isIdentifier(statement.expression.expression)
  && statement.expression.expression.text === 'useDidHide'
)) as ts.ExpressionStatement | undefined
assert.ok(hideHook && ts.isCallExpression(hideHook.expression), '应能提取生产页面的隐藏回调')
const hideCallback = (hideHook!.expression as ts.CallExpression).arguments[0]
assert.ok(hideCallback && ts.isArrowFunction(hideCallback), '隐藏处理应为实际生命周期回调')

const mergeGoodsDeclaration = findVariable(sourceFile, 'mergeGoods')
assert.ok(mergeGoodsDeclaration.initializer, '应在生产搜索页找到商品合并实现')
const sameSearchQueryDeclaration = findVariable(sourceFile, 'sameAffiliateSearchQuery')
assert.ok(sameSearchQueryDeclaration.initializer, '应在生产搜索页找到查询身份比较实现')
const handlerNames = [
  'runSearch',
  'loadNextPage',
  'handleSearch',
  'retrySearch',
  'applySort',
  'applyFilters',
  'handlePasteAndResolve',
]
const extractedSource = [
  `const mergeGoods = ${mergeGoodsDeclaration.initializer!.getText(sourceFile)}`,
  `const sameAffiliateSearchQuery = ${sameSearchQueryDeclaration.initializer!.getText(sourceFile)}`,
  ...handlerNames.map((name) => `const ${name} = ${extractHandler(name)}`),
  `const handlePageHide = ${hideCallback!.getText(sourceFile)}`,
  `return { ${handlerNames.join(', ')}, handlePageHide }`,
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
  clipboard?: () => Promise<{ data?: string }>
  refreshCapabilities?: () => Promise<{ capabilities: typeof enabledCapabilities }>
  resolveContent?: (content: string) => Promise<ResolveResponse>
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
    resolveLoading: false,
    resolveMessage: '',
    resolvedGoods: null as SearchItem | null,
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
  const capabilitySnapshot = { capabilities: { ...enabledCapabilities }, revision: 1 }
  const clipboardReads: string[] = []
  const resolveRequests: string[] = []
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
      capabilities: capabilitySnapshot.capabilities,
      resolveLoading: state.resolveLoading,
      setCustomTabBarHidden: () => undefined,
      useCallback: (callback: (...args: any[]) => unknown) => callback,
      Taro: {
        showToast: () => undefined,
        getClipboardData: () => {
          clipboardReads.push('read')
          return options.clipboard ? options.clipboard() : Promise.resolve({ data: 'https://item.taobao.com/item.htm?id=123' })
        },
      },
      refreshAffiliateCapabilities: options.refreshCapabilities || (async () => ({ capabilities: capabilitySnapshot.capabilities })),
      getAffiliateCapabilitySnapshot: () => capabilitySnapshot,
      canUseAffiliateCapability,
      dispatchAffiliateSearchInput,
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
      resolveStatusText: {
        unsupported_format: '不支持',
        not_found: '未找到',
        unavailable: '暂不可用',
        resolved: '已核验',
      },
      resolveAffiliateContent: async (content: string) => {
        resolveRequests.push(content)
        return options.resolveContent ? options.resolveContent(content) : {
          status: 'resolved',
          product: { goods_id: 'resolved-goods', title: '已核验商品' },
        }
      },
      cacheAffiliateGoods: () => undefined,
      setResolveLoading: (value: boolean) => { state.resolveLoading = value },
      setResolvedGoods: (value: SearchItem | null) => { state.resolvedGoods = value },
      setResolveMessage: (value: string) => { state.resolveMessage = value },
    }
    const keys = Object.keys(env)
    const factory = new Function(...keys, extractedJavaScript.outputText) as (...values: unknown[]) => Record<string, (...args: any[]) => any>
    const handlers = factory(...keys.map((key) => (env as Record<string, unknown>)[key]))
    refs.runSearchRef.current = handlers.runSearch
    return handlers
  }
  return {
    state,
    refs,
    requests,
    clipboardReads,
    resolveRequests,
    capabilitySnapshot,
    setCapabilities: (next: Partial<typeof enabledCapabilities>) => {
      Object.assign(capabilitySnapshot.capabilities, next)
      capabilitySnapshot.revision += 1
    },
    render,
  }
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

const verifyDoubleSubmitDoesNotDuplicateInFlightQuery = async () => {
  const bootstrap = deferred<{ capabilities: typeof enabledCapabilities }>()
  let bootstrapRequests = 0
  const harness = createHarness({
    draftKeyword: '宿舍收纳盒',
    submittedKeyword: '旧查询',
    currentItems: [],
    refreshCapabilities: () => {
      bootstrapRequests += 1
      return bootstrap.promise
    },
  })

  harness.render().handleSearch()
  assert.equal(bootstrapRequests, 1, '第一次同词提交应开始刷新能力')
  harness.render().handleSearch()
  assert.equal(bootstrapRequests, 1, '同关键词和筛选的并发提交应复用进行中的请求')

  bootstrap.resolve({ capabilities: harness.capabilitySnapshot.capabilities })
  await waitForAsyncHandlers()
  assert.deepEqual(harness.requests, [
    { keyword: '宿舍收纳盒', page: 1, filters: { sort: 'comprehensive' } },
  ], '等待能力刷新时重复提交同一查询只能发出一次商品搜索')
}

const verifyNewKeywordSupersedesPendingSearch = async () => {
  const firstBootstrap = deferred<{ capabilities: typeof enabledCapabilities }>()
  let bootstrapRequests = 0
  const harness = createHarness({
    draftKeyword: '纸巾',
    submittedKeyword: '旧查询',
    currentItems: [],
    refreshCapabilities: () => {
      bootstrapRequests += 1
      return bootstrapRequests === 1
        ? firstBootstrap.promise
        : Promise.resolve({ capabilities: harness.capabilitySnapshot.capabilities })
    },
  })

  harness.render().handleSearch()
  harness.state.keyword = '杯子'
  harness.render().handleSearch()
  assert.equal(bootstrapRequests, 2, '新关键词应取代正在等待能力刷新的旧关键词')
  await waitForAsyncHandlers()
  firstBootstrap.resolve({ capabilities: harness.capabilitySnapshot.capabilities })
  await waitForAsyncHandlers()
  assert.deepEqual(harness.requests, [
    { keyword: '杯子', page: 1, filters: { sort: 'comprehensive' } },
  ], '新关键词提交后，旧查询不得继续请求商品搜索')
  assert.equal(harness.state.searchResult.query?.keyword, '杯子')
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

const verifyDoublePasteDoesNotDuplicateResolve = async () => {
  const clipboard = deferred<{ data: string }>()
  const bootstrap = deferred<{ capabilities: typeof enabledCapabilities }>()
  let bootstrapRequests = 0
  const harness = createHarness({
    draftKeyword: '',
    submittedKeyword: '',
    currentItems: [],
    clipboard: () => clipboard.promise,
    refreshCapabilities: () => {
      bootstrapRequests += 1
      return bootstrap.promise
    },
  })

  const handlers = harness.render()
  const firstResolve = handlers.handlePasteAndResolve()
  const secondResolve = handlers.handlePasteAndResolve()
  assert.equal(
    harness.clipboardReads.length,
    1,
    '剪贴板读取挂起期间的第二次点击必须在发起异步操作前被占用状态拦截',
  )
  assert.equal(harness.refs.resolveInFlightRef.current, true)

  clipboard.resolve({ data: 'https://item.taobao.com/item.htm?id=123' })
  await Promise.resolve()
  await Promise.resolve()
  assert.equal(bootstrapRequests, 1, '同一次粘贴操作只能刷新一次能力快照')

  bootstrap.resolve({ capabilities: harness.capabilitySnapshot.capabilities })
  await Promise.all([firstResolve, secondResolve])
  assert.equal(harness.resolveRequests.length, 1, '同一次粘贴操作只能提交一次解析 POST')
  assert.deepEqual(harness.state.resolvedGoods, {
    goods_id: 'resolved-goods',
    title: '已核验商品',
    resolution_token: undefined,
    requires_resolution_token: true,
  })
  assert.equal(harness.state.resolveLoading, false)
  assert.equal(harness.refs.resolveInFlightRef.current, false)
}

const verifyDoubleInputResolveDoesNotDuplicateWhileRefreshingCapabilities = async () => {
  const bootstrap = deferred<{ capabilities: typeof enabledCapabilities }>()
  let bootstrapRequests = 0
  const harness = createHarness({
    draftKeyword: 'https://item.taobao.com/item.htm?id=123',
    submittedKeyword: '',
    currentItems: [],
    refreshCapabilities: () => {
      bootstrapRequests += 1
      return bootstrap.promise
    },
  })

  harness.render().handleSearch()
  assert.equal(bootstrapRequests, 1, '第一次分享链接提交应开始刷新能力')
  assert.equal(harness.refs.resolveInFlightRef.current, true)
  harness.render().handleSearch()
  assert.equal(bootstrapRequests, 1, '能力刷新等待期间再次提交同一链接不得释放解析锁')

  bootstrap.resolve({ capabilities: harness.capabilitySnapshot.capabilities })
  await waitForAsyncHandlers()
  assert.equal(harness.resolveRequests.length, 1, '重复提交链接只能发出一次解析 POST')
  assert.deepEqual(harness.resolveRequests, ['https://item.taobao.com/item.htm?id=123'])
  assert.equal(harness.requests.length, 0, '链接解析不得误发商品关键词搜索')
}

const verifyStaleResolveCannotCrossPageOrCapabilityGeneration = async () => {
  const leftPageClipboard = deferred<{ data: string }>()
  const currentPageClipboard = deferred<{ data: string }>()
  const clipboardResults = [leftPageClipboard, currentPageClipboard]
  let clipboardIndex = 0
  let refreshRequests = 0
  const harness = createHarness({
    draftKeyword: '',
    submittedKeyword: '',
    currentItems: [],
    clipboard: () => clipboardResults[clipboardIndex++].promise,
    refreshCapabilities: async () => {
      refreshRequests += 1
      return { capabilities: { ...enabledCapabilities } }
    },
  })

  const oldPageOperation = harness.render().handlePasteAndResolve()
  harness.render().handlePageHide()
  harness.setCapabilities({ resolve_enabled: false })
  harness.setCapabilities({ resolve_enabled: true })

  const currentPageOperation = harness.render().handlePasteAndResolve()
  leftPageClipboard.resolve({ data: 'https://old.example/item' })
  await oldPageOperation
  assert.equal(harness.refs.resolveInFlightRef.current, true, '旧操作结束不得释放新一代操作的占用状态')
  assert.equal(harness.state.resolveMessage, '正在核验商品和优惠信息…', '旧操作不得覆盖新页面的状态')
  assert.equal(refreshRequests, 0, '离开页面且能力代次改变后，旧剪贴板内容不得刷新配置或发出解析请求')
  assert.equal(harness.resolveRequests.length, 0)

  currentPageClipboard.resolve({ data: 'https://current.example/item' })
  await currentPageOperation
  assert.equal(refreshRequests, 1)
  assert.deepEqual(harness.resolveRequests, ['https://current.example/item'])
  assert.deepEqual(harness.state.resolvedGoods, {
    goods_id: 'resolved-goods',
    title: '已核验商品',
    resolution_token: undefined,
    requires_resolution_token: true,
  })
  assert.equal(harness.refs.resolveInFlightRef.current, false)
}

const verifyPageHidePreservesCompletedResolveState = async () => {
  const completed = createHarness({ draftKeyword: '', submittedKeyword: '', currentItems: [] })
  await completed.render().handlePasteAndResolve()
  const completedMessage = completed.state.resolveMessage
  const completedProduct = completed.state.resolvedGoods
  completed.render().handlePageHide()
  assert.equal(completed.state.resolveMessage, completedMessage, '查看商品详情后返回，不得把已完成解析误报为取消')
  assert.equal(completed.state.resolvedGoods, completedProduct, '离页不得清除已完成解析的商品')
  assert.equal(completed.state.resolveLoading, false)
  assert.equal(completed.refs.resolveInFlightRef.current, false)

  for (const message of ['', '解析服务失败']) {
    const idle = createHarness({ draftKeyword: '', submittedKeyword: '', currentItems: [] })
    idle.state.resolveMessage = message
    idle.render().handlePageHide()
    assert.equal(idle.state.resolveMessage, message, '没有进行中操作时应保留空态或失败原因')
  }

  const clipboard = deferred<{ data: string }>()
  const pending = createHarness({
    draftKeyword: '', submittedKeyword: '', currentItems: [], clipboard: () => clipboard.promise,
  })
  const operation = pending.render().handlePasteAndResolve()
  pending.render().handlePageHide()
  assert.equal(pending.state.resolveMessage, '当前页面已离开，查询已取消。', '进行中的解析离页时应提示取消')
  assert.equal(pending.state.resolveLoading, false)
  assert.equal(pending.refs.resolveInFlightRef.current, false)
  clipboard.resolve({ data: 'https://old.example/item' })
  await operation
  assert.equal(pending.resolveRequests.length, 0, '取消后的剪贴板回包不得提交解析')
  assert.equal(pending.state.resolveMessage, '当前页面已离开，查询已取消。', '旧操作结束不得覆盖取消提示')
}

const verifyResolveFailurePathsReleaseOperation = async () => {
  const scenarios: Array<{
    name: string
    clipboard: () => Promise<{ data?: string }>
    refreshCapabilities?: () => Promise<{ capabilities: typeof enabledCapabilities }>
    resolveContent?: (content: string) => Promise<ResolveResponse>
    message: RegExp
    expectedPosts: number
  }> = [
    {
      name: '剪贴板读取失败',
      clipboard: async () => { throw new Error('clipboard denied') },
      message: /读取剪贴板失败/u,
      expectedPosts: 0,
    },
    {
      name: '空剪贴板',
      clipboard: async () => ({ data: '  ' }),
      message: /剪贴板里没有内容/u,
      expectedPosts: 0,
    },
    {
      name: '超长剪贴板',
      clipboard: async () => ({ data: 'x'.repeat(2049) }),
      message: /内容过长/u,
      expectedPosts: 0,
    },
    {
      name: '刷新能力后解析关闭',
      clipboard: async () => ({ data: 'https://item.taobao.com/item.htm?id=123' }),
      refreshCapabilities: async () => ({
        capabilities: { ...enabledCapabilities, resolve_enabled: false },
      }),
      message: /暂不可用/u,
      expectedPosts: 0,
    },
    {
      name: '解析请求失败',
      clipboard: async () => ({ data: 'https://item.taobao.com/item.htm?id=123' }),
      resolveContent: async () => { throw new Error('解析服务失败') },
      message: /解析服务失败/u,
      expectedPosts: 1,
    },
  ]

  for (const scenario of scenarios) {
    const harness = createHarness({
      draftKeyword: '',
      submittedKeyword: '',
      currentItems: [],
      clipboard: scenario.clipboard,
      refreshCapabilities: scenario.refreshCapabilities,
      resolveContent: scenario.resolveContent,
    })
    await harness.render().handlePasteAndResolve()
    assert.match(harness.state.resolveMessage, scenario.message, `${scenario.name} 应保留具体错误状态`)
    assert.equal(harness.resolveRequests.length, scenario.expectedPosts, `${scenario.name} 的 POST 数量应符合预期`)
    assert.equal(harness.state.resolveLoading, false, `${scenario.name} 后应关闭加载状态`)
    assert.equal(harness.refs.resolveInFlightRef.current, false, `${scenario.name} 后应释放操作占用`)
  }
}

const verifyUnrelatedCapabilityChangeLeavesResolveRetryable = async () => {
  const bootstrap = deferred<{ capabilities: typeof enabledCapabilities }>()
  const bootstrapStarted = deferred<void>()
  let bootstrapRequests = 0
  const harness = createHarness({
    draftKeyword: '',
    submittedKeyword: '',
    currentItems: [],
    clipboard: async () => ({ data: 'https://item.taobao.com/item.htm?id=123' }),
    refreshCapabilities: () => {
      bootstrapRequests += 1
      if (bootstrapRequests === 1) {
        bootstrapStarted.resolve()
        return bootstrap.promise
      }
      return Promise.resolve({ capabilities: { ...harness.capabilitySnapshot.capabilities } })
    },
  })

  const interruptedResolve = harness.render().handlePasteAndResolve()
  await bootstrapStarted.promise
  harness.setCapabilities({ convert_enabled: false })
  bootstrap.resolve({ capabilities: { ...enabledCapabilities } })
  await interruptedResolve

  assert.equal(harness.resolveRequests.length, 0, '其他推广能力变化后，旧解析代次不得提交 POST')
  assert.equal(harness.state.resolveLoading, false, '被能力代次中断后应结束加载')
  assert.equal(harness.refs.resolveInFlightRef.current, false, '被能力代次中断后应释放占用')
  assert.equal(harness.state.resolveMessage, '查询已中断，请重试。', '其他能力变化后不得残留“正在核验”状态')

  await harness.render().handlePasteAndResolve()
  assert.equal(harness.resolveRequests.length, 1, '能力变更后用户可重新触发链接解析')
  assert.equal(harness.resolveRequests[0], 'https://item.taobao.com/item.htm?id=123')
  assert.equal(harness.state.resolveLoading, false)
  assert.equal(harness.refs.resolveInFlightRef.current, false)
}

assert.match(
  source,
  /useDidHide\(\(\) => \{\s*setCustomTabBarHidden\(false\)[\s\S]*?resolveRevision\.current \+= 1[\s\S]*?resolveInFlightRef\.current = false/u,
  '页面离开时必须让尚未完成的解析失效并释放占用状态',
)
assert.match(
  source,
  /useEffect\(\(\) => \(\) => \{\s*resolveRevision\.current \+= 1[\s\S]*?resolveInFlightRef\.current = false[\s\S]*?\}, \[\]\)/u,
  '页面卸载时必须让尚未完成的解析失效',
)

export const runAffiliateSearchQueryIdentitySmoke = async () => {
  await verifyDraftEditsAndRetryStayOnSubmittedQuery()
  await verifyClearedDraftDoesNotBlockSubmittedPagination()
  await verifySubmittingNewKeywordReplacesResults()
  await verifyDoubleSubmitDoesNotDuplicateInFlightQuery()
  await verifyNewKeywordSupersedesPendingSearch()
  await verifyFirstPageRetryStaysOnSubmittedQuery()
  await verifySortAndFiltersUseSubmittedKeyword()
  await verifyOldResponseCannotReplaceNewQuery()
  await verifyDoublePasteDoesNotDuplicateResolve()
  await verifyDoubleInputResolveDoesNotDuplicateWhileRefreshingCapabilities()
  await verifyStaleResolveCannotCrossPageOrCapabilityGeneration()
  await verifyPageHidePreservesCompletedResolveState()
  await verifyResolveFailurePathsReleaseOperation()
  await verifyUnrelatedCapabilityChangeLeavesResolveRetryable()
}

if (require.main === module) {
  void runAffiliateSearchQueryIdentitySmoke().then(() => {
    console.log('affiliate search query identity smoke passed')
  }).catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
