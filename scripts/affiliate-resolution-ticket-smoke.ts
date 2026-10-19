import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts = require('typescript')
import {
  isCurrentAffiliateCopyOperation,
  type AffiliateCopyOperationIdentity,
} from '../src/features/affiliate/capability-policy'
import { runAffiliateConversionAfterRefresh } from '../src/features/affiliate/purchase-policy'
import {
  cacheAffiliateGoods,
  clearAffiliateGoodsResolutionToken,
  getCachedAffiliateGoods,
} from '../src/features/affiliate/session-cache'

const readSource = (path: string) => readFileSync(join(__dirname, path), 'utf8')
const readVariable = (source: string, filename: string, name: string) => {
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let initializer: ts.Expression | undefined
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.name.text === name) {
      initializer = node.initializer
      return
    }
    if (!initializer) node.forEachChild(visit)
  }
  visit(file)
  assert.ok(initializer, `应在 ${filename} 中找到 ${name}`)
  return initializer!.getText(file)
}

const sheetSource = readSource('../src/features/affiliate/components/coupon-purchase-sheet.tsx')
const extractedConvert = ts.transpileModule(
  `const convert = ${readVariable(sheetSource, 'coupon-purchase-sheet.tsx', 'convert')}; return convert`,
  { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } },
)
const createConvert = new Function(
  'useCallback',
  'requestRevision',
  'getAffiliateCapabilitySnapshot',
  'currentGoodsIdRef',
  'currentResolutionTokenRef',
  'requiresResolutionTokenRef',
  'setLoading',
  'setError',
  'setResolutionTicketFailure',
  'setResult',
  'setCopyFallback',
  'setRefreshConfirmationRequired',
  'runAffiliateConversionAfterRefresh',
  'canUseAffiliateCapability',
  'refreshAffiliateCapabilities',
  'convertAffiliateGoods',
  'convertAffiliateResolution',
  'getAffiliateResolutionTicketFailure',
  'getAffiliateResolutionTicketMessage',
  'clearAffiliateGoodsResolutionToken',
  'onResolutionTokenInvalidRef',
  extractedConvert.outputText,
) as (...args: unknown[]) => (product: Record<string, unknown>) => Promise<unknown>

const ticketSource = readSource('../src/features/affiliate/resolution-ticket.ts')
const extractedTicketFailure = ts.transpileModule(
  `const getAffiliateResolutionTicketFailure = ${readVariable(ticketSource, 'resolution-ticket.ts', 'getAffiliateResolutionTicketFailure')}; return getAffiliateResolutionTicketFailure`,
  { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } },
)
const createTicketFailure = new Function('isApiError', extractedTicketFailure.outputText) as (
  isApiError: (error: unknown) => boolean,
) => (error: unknown) => 'expired' | 'changed' | null
const extractedTicketMessage = ts.transpileModule(
  `const getAffiliateResolutionTicketMessage = ${readVariable(ticketSource, 'resolution-ticket.ts', 'getAffiliateResolutionTicketMessage')}; return getAffiliateResolutionTicketMessage`,
  { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } },
)
const createTicketMessage = new Function(extractedTicketMessage.outputText) as () => (
  failure: 'expired' | 'changed' | 'missing',
) => string
const getTicketMessage = createTicketMessage()

const getTicketFailure = createTicketFailure((error) => Boolean(
  error && typeof error === 'object' && 'code' in error,
))
assert.equal(
  getTicketFailure({ code: 'affiliate_resolution_expired' }),
  'expired',
  '服务端应以稳定的 expired code 要求重新粘贴',
)
assert.equal(
  getTicketFailure({ code: 'affiliate_resolution_changed' }),
  'changed',
  '服务端应以稳定的 changed code 要求重新粘贴',
)
assert.equal(getTicketFailure({ code: 'upstream_unavailable' }), null)

const affiliateApiSource = readSource('../src/api/affiliate.ts')
const extractedResolutionApi = ts.transpileModule(
  `const convertAffiliateResolution = ${readVariable(affiliateApiSource, 'affiliate.ts', 'convertAffiliateResolution')}; return convertAffiliateResolution`,
  { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } },
)
const createResolutionApi = new Function('apiRequest', extractedResolutionApi.outputText) as (
  apiRequest: (options: Record<string, unknown>) => unknown,
) => (token: string) => unknown
const convertResolutionApi = createResolutionApi((options) => options)

const searchSource = readSource('../src/pages/goods/search.tsx')
const resolvedProductFactory = ts.transpileModule(
  `const resolvedProduct = ${readVariable(searchSource, 'search.tsx', 'resolvedProduct')}; return resolvedProduct`,
  { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } },
)
const createResolvedProduct = new Function('result', resolvedProductFactory.outputText) as (
  result: { product: Record<string, unknown>; resolution_token?: string | null },
) => Record<string, unknown>

const enabledCapabilities = {
  enabled: true,
  search_enabled: true,
  resolve_enabled: true,
  convert_enabled: true,
}
const conversionResult = {
  goods_id: 'goods-1',
  coupon_status: 'none',
  share_url: 'https://example.com/share',
  coupon_url: null,
  taobao_password: '淘口令',
  expires_at: null,
}

const createHarness = (options: {
  token?: string | null
  requiresToken?: boolean
  convertError?: unknown
  refresh?: () => void
} = {}) => {
  const requestRevision = { current: 0 }
  const currentGoodsIdRef = { current: 'goods-1' }
  const currentResolutionTokenRef = { current: options.token }
  const requiresResolutionTokenRef = { current: options.requiresToken === true }
  const calls: string[] = []
  const state: {
    loading: boolean
    error: string
    failure: string | null
    result: unknown
    invalidated: number
  } = { loading: false, error: '', failure: null, result: null, invalidated: 0 }
  const onResolutionTokenInvalidRef = { current: () => { state.invalidated += 1 } }
  const getAffiliateCapabilitySnapshot = () => ({ revision: 7, capabilities: enabledCapabilities })
  const convert = createConvert(
    <T,>(callback: T) => callback,
    requestRevision,
    getAffiliateCapabilitySnapshot,
    currentGoodsIdRef,
    currentResolutionTokenRef,
    requiresResolutionTokenRef,
    (value) => { state.loading = value as boolean },
    (value) => { state.error = value as string },
    (value) => { state.failure = value as string | null },
    (value) => { state.result = value },
    () => undefined,
    () => undefined,
    runAffiliateConversionAfterRefresh,
    (capabilities, capability) => capability === 'convert' && (capabilities as typeof enabledCapabilities).convert_enabled,
    async () => { options.refresh?.(); return getAffiliateCapabilitySnapshot() },
    async (goodsId) => {
      calls.push(`goods:${goodsId}`)
      return conversionResult
    },
    async (token) => {
      calls.push(`resolution:${token}`)
      if (options.convertError) throw options.convertError
      return conversionResult
    },
    getTicketFailure,
    getTicketMessage,
    clearAffiliateGoodsResolutionToken,
    onResolutionTokenInvalidRef,
  )
  return { convert, state, calls, currentResolutionTokenRef }
}

const resolutionToken = 'opaque-ticket-1'
const parsedGoods = {
  goods_id: 'goods-1',
  title: '解析商品',
  coupon_status: 'none',
  availability: 'valid',
  resolution_token: resolutionToken,
  requires_resolution_token: true,
}

const run = async () => {
  const apiOptions = await convertResolutionApi('opaque-ticket-only') as Record<string, unknown>
  assert.equal(apiOptions.path, '/api/v1/affiliate/resolve/convert')
  assert.equal(apiOptions.method, 'POST')
  assert.deepEqual(apiOptions.data, { resolution_token: 'opaque-ticket-only' })
  assert.equal('goods_id' in (apiOptions.data as Record<string, unknown>), false, '解析凭证请求不能携带替代 goods_id')

  const parsedSourceProduct = {
    goods_id: 'goods-1',
    title: '大淘客解析商品',
    coupon_status: 'none',
    availability: 'valid',
    actual_price: null,
  }
  assert.deepEqual(
    createResolvedProduct({ product: parsedSourceProduct, resolution_token: resolutionToken }),
    {
      ...parsedSourceProduct,
      resolution_token: resolutionToken,
      requires_resolution_token: true,
    },
    '解析返回的商品展示字段应直接使用，同时绑定本次短期凭证，不追加素材查询',
  )
  assert.match(searchSource, /Taro\.navigateTo\(\{ url: `\/pages\/goods\/detail\?goods_id=\$\{encodeURIComponent\(goods\.goods_id\)\}` \}\)/u)
  assert.doesNotMatch(searchSource, /goods_id=[^`]*resolution_token/u, '详情路由中不得携带解析凭证')

  const parsed = createHarness({ token: resolutionToken, requiresToken: true })
  await parsed.convert(parsedGoods)
  assert.deepEqual(parsed.calls, [`resolution:${resolutionToken}`], '解析商品必须使用专用解析凭证接口')
  assert.equal(parsed.state.result, conversionResult)

  const ordinary = createHarness()
  await ordinary.convert({ goods_id: 'goods-1', title: '普通搜索商品' })
  assert.deepEqual(ordinary.calls, ['goods:goods-1'], '普通搜索商品仍使用 goods_id 转链接口')

  const expiredError = Object.assign(new Error('expired'), { code: 'affiliate_resolution_expired' })
  cacheAffiliateGoods(parsedGoods)
  const expired = createHarness({
    token: resolutionToken,
    requiresToken: true,
    convertError: expiredError,
  })
  await expired.convert(parsedGoods)
  assert.deepEqual(expired.calls, [`resolution:${resolutionToken}`], '解析凭证失效时不得回退到 goods_id 接口')
  assert.equal(expired.state.failure, 'expired')
  assert.match(expired.state.error, /重新粘贴淘宝商品链接或淘口令/u)
  assert.equal(expired.state.invalidated, 1, '解析凭证失效后应通知页面清理旧商品凭证')
  assert.equal(getCachedAffiliateGoods('goods-1')?.resolution_token, undefined, '会话缓存应清除匹配的失效凭证')

  const changedToken = 'opaque-ticket-changed'
  cacheAffiliateGoods({ ...parsedGoods, resolution_token: changedToken })
  const changed = createHarness({
    token: changedToken,
    requiresToken: true,
    convertError: Object.assign(new Error('changed'), { code: 'affiliate_resolution_changed' }),
  })
  await changed.convert({ ...parsedGoods, resolution_token: changedToken })
  assert.deepEqual(changed.calls, [`resolution:${changedToken}`], '商品身份变化时仍只能向解析专用接口重试')
  assert.equal(changed.state.failure, 'changed')
  assert.match(changed.state.error, /商品内容已变化，请重新粘贴淘宝商品链接或淘口令/u)
  assert.equal(getCachedAffiliateGoods('goods-1')?.resolution_token, undefined, '商品身份变化后应清除匹配的失效凭证')

  const missing = createHarness({ requiresToken: true })
  await missing.convert({ ...parsedGoods, resolution_token: undefined })
  assert.deepEqual(missing.calls, [], '缺少解析凭证时不得使用旧转链接口')
  assert.equal(missing.state.failure, 'missing')

  const switched = createHarness({ token: resolutionToken, requiresToken: true, refresh: () => undefined })
  const switchingConvert = switched.convert(parsedGoods)
  switched.currentResolutionTokenRef.current = 'opaque-ticket-2'
  await switchingConvert
  assert.deepEqual(switched.calls, [], '同 goods_id 重新解析后，旧 token 在能力刷新边界也必须失效')

  const currentIdentity: AffiliateCopyOperationIdentity = {
    requestRevision: 3,
    capabilityRevision: 7,
    goodsId: 'goods-1',
    resolutionToken: 'opaque-ticket-2',
    requiresResolutionToken: true,
  }
  const capturedIdentity = { ...currentIdentity, resolutionToken: 'opaque-ticket-1' }
  assert.equal(
    isCurrentAffiliateCopyOperation(currentIdentity, capturedIdentity, enabledCapabilities),
    false,
    '相同商品重新解析后，旧 token 的复制流程必须失效',
  )

  cacheAffiliateGoods(parsedGoods)
  cacheAffiliateGoods({ ...parsedGoods, resolution_token: 'opaque-ticket-2' })
  assert.equal(
    clearAffiliateGoodsResolutionToken('goods-1', resolutionToken),
    false,
    '清理较早解析的凭证不得删除同商品的新解析凭证',
  )
  assert.equal(getCachedAffiliateGoods('goods-1')?.resolution_token, 'opaque-ticket-2')
  cacheAffiliateGoods({ ...parsedGoods, resolution_token: undefined, requires_resolution_token: false })
  assert.equal(
    getCachedAffiliateGoods('goods-1')?.resolution_token,
    undefined,
    '普通搜索结果覆盖同 goods_id 时不得继承解析凭证',
  )

  console.log('Affiliate resolution ticket regression checks passed')
}

void run()
