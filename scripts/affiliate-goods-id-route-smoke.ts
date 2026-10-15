import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import ts = require('typescript')

type Route = { id: number; goodsId: string }
type RouteOptions = { id?: string; goods_id?: string }
type PageState = {
  route: Route | null
  error: string
  loading: boolean
  missingGoodsContext: boolean
  product: unknown
  purchaseProduct: unknown
  requestRevision: { current: number }
  requestedGoodsId: string[]
  loadedProductIds: number[]
}
type Dependencies = {
  route: Route | null
  capabilitySnapshot: { loaded: boolean; revision: number }
  capabilities: { enabled: boolean }
  requestRevision: PageState['requestRevision']
  setRoute: (route: Route) => void
  setLoading: (loading: boolean) => void
  setError: (error: string) => void
  setMissingGoodsContext: (missing: boolean) => void
  setProduct: (product: unknown) => void
  setPurchaseProduct: (product: unknown) => void
  loadProduct: (id: number) => void
  getCachedAffiliateGoods: (goodsId: string) => null
  pageState: PageState
}

const sourceText = readFileSync('src/pages/goods/detail.tsx', 'utf8')
const sourceFile = ts.createSourceFile(
  'detail.tsx',
  sourceText,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
)
const component = sourceFile.statements.find((statement) => (
  ts.isFunctionDeclaration(statement) && statement.name?.text === 'AffiliateProductDetailPage'
))
assert.ok(component, '应能找到商品详情页面组件')

const extractHookCallback = (hookName: string) => {
  let found: ts.ArrowFunction | undefined
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)
      && ts.isIdentifier(node.expression)
      && node.expression.text === hookName) {
      const callback = node.arguments[0]
      if (callback && ts.isArrowFunction(callback)) found = callback
      return
    }
    if (!found) node.forEachChild(visit)
  }
  visit(component!)
  assert.ok(found, `商品详情页应注册 ${hookName} 回调`)
  return found!
}

const callbackSource = [
  `const onLoad = ${extractHookCallback('useLoad').getText(sourceFile)}`,
  `const routeEffect = ${extractHookCallback('useEffect').getText(sourceFile)}`,
  'return { onLoad, routeEffect }',
].join('\n')
const compiledCallbacks = ts.transpileModule(callbackSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
  reportDiagnostics: true,
})
const compileErrors = (compiledCallbacks.diagnostics || []).filter((diagnostic) => (
  diagnostic.category === ts.DiagnosticCategory.Error
))
assert.equal(compileErrors.length, 0, '应能编译从生产页面提取的真实路由回调')

const createCallbacks = new Function(
  'dependencies',
  [
    'const { route, capabilitySnapshot, capabilities, requestRevision, setRoute, setLoading, setError, setMissingGoodsContext, setProduct, setPurchaseProduct, loadProduct, getCachedAffiliateGoods } = dependencies',
    compiledCallbacks.outputText,
  ].join('\n'),
) as (dependencies: Dependencies) => {
  onLoad: (options: RouteOptions) => void
  routeEffect: () => (() => void) | void
}

const createHarness = (): { state: PageState; dependencies: Omit<Dependencies, 'route'> } => {
  const state: PageState = {
    route: null,
    error: '',
    loading: true,
    missingGoodsContext: false,
    product: null,
    purchaseProduct: null,
    requestRevision: { current: 0 },
    requestedGoodsId: [],
    loadedProductIds: [],
  }
  const dependencies: Omit<Dependencies, 'route'> = {
    capabilitySnapshot: { loaded: true, revision: 1 },
    capabilities: { enabled: true },
    requestRevision: state.requestRevision,
    setRoute: (route) => { state.route = route },
    setLoading: (loading) => { state.loading = loading },
    setError: (error) => { state.error = error },
    setMissingGoodsContext: (missing) => { state.missingGoodsContext = missing },
    setProduct: (product) => { state.product = product },
    setPurchaseProduct: (product) => { state.purchaseProduct = product },
    loadProduct: (id) => { state.loadedProductIds.push(id) },
    getCachedAffiliateGoods: (goodsId) => {
      state.requestedGoodsId.push(goodsId)
      return null
    },
    pageState: state,
  }
  return { state, dependencies }
}

const runLoad = (options: RouteOptions) => {
  const harness = createHarness()
  createCallbacks({ ...harness.dependencies, route: null }).onLoad(options)
  const route = harness.state.route
  assert.ok(route, 'useLoad 应保存解析后的商品路由')
  const routeEffect = createCallbacks({ ...harness.dependencies, route }).routeEffect
  routeEffect()
  return harness.state
}

// useLoad 接收的是 Taro 已解码的 query 值；尾随空格可能来自原始 URL 的 %20。
const opaqueGoodsId = 'sku+%/校园 商品 '
const opaqueRoute = runLoad({ goods_id: opaqueGoodsId })
assert.deepEqual(opaqueRoute.route, { id: 0, goodsId: opaqueGoodsId })
assert.deepEqual(opaqueRoute.requestedGoodsId, [opaqueGoodsId], '查询缓存时必须逐字节传递 opaque goods_id')
assert.equal(opaqueRoute.missingGoodsContext, true)
assert.equal(opaqueRoute.error, '')

const recommendedRoute = runLoad({ id: '42', goods_id: opaqueGoodsId })
assert.deepEqual(recommendedRoute.route, { id: 42, goodsId: '' }, '数字推荐商品路由仍应优先解析为 id')
assert.deepEqual(recommendedRoute.loadedProductIds, [42])

const emptyRoute = runLoad({ goods_id: '   ' })
assert.deepEqual(emptyRoute.route, { id: 0, goodsId: '' }, '纯空白 goods_id 应判为空参数')
assert.equal(emptyRoute.error, '商品链接无效', '空参数仍应显示详情路由错误')
assert.equal(emptyRoute.loading, false)

console.log('Affiliate goods ID route regression checks passed')
