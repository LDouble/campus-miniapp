import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts = require('typescript')
import type { AffiliateConvertResult } from '../src/api/affiliate'
import type { AffiliatePurchaseProduct } from '../src/features/affiliate/components/product-card'
import {
  isCurrentAffiliateCopyOperation,
  runAffiliateCopyIfCurrent,
  type AffiliateCopyOperationIdentity,
} from '../src/features/affiliate/capability-policy'
import {
  hasAffiliateOfferChanged,
  isAffiliateCopyFallbackUsable,
  isAffiliateLinkExpired,
  runAffiliatePurchaseCopyWorkflow,
  type AffiliateCopyFallback,
} from '../src/features/affiliate/purchase-policy'

const baseProduct: AffiliatePurchaseProduct = {
  goods_id: 'goods-1',
  title: '测试商品',
  coupon_status: 'active',
  availability: 'valid',
  actual_price: '19.90',
  coupon_amount: '5',
  coupon_condition: '满 20 元可用',
}

const baseResult: AffiliateConvertResult = {
  goods_id: 'goods-1',
  coupon_status: 'active',
  share_url: 'https://example.com/share',
  coupon_url: 'https://example.com/coupon',
  taobao_password: '口令',
  coupon_amount: '5.00',
  coupon_condition: '满 20 元可用',
  actual_price: '19.90',
  expires_at: null,
}

const now = Date.parse('2026-10-15T12:00:00.000Z')
const couponPurchaseSheetSource = readFileSync(join(
  __dirname,
  '../src/features/affiliate/components/coupon-purchase-sheet.tsx',
), 'utf8')
const couponPurchaseSheetFile = ts.createSourceFile(
  'coupon-purchase-sheet.tsx',
  couponPurchaseSheetSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
)

const findComponentVariable = (name: string) => {
  const component = couponPurchaseSheetFile.statements.find((statement) => (
    ts.isFunctionDeclaration(statement) && statement.name?.text === 'CouponPurchaseSheet'
  ))
  assert.ok(component, '应在优惠购买组件中找到 CouponPurchaseSheet')
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
  visit(component!)
  assert.ok(found?.initializer, `应在优惠购买组件中找到 ${name}`)
  return found!.initializer!.getText(couponPurchaseSheetFile)
}

const extractedCopyHandlerSource = [
  `const getCurrentCopyIdentity = ${findComponentVariable('getCurrentCopyIdentity')}`,
  `const isCurrentCopyOperation = ${findComponentVariable('isCurrentCopyOperation')}`,
  `const copyConvertedLink = ${findComponentVariable('copyConvertedLink')}`,
  'return { copyConvertedLink }',
].join('\n')
const extractedCopyHandler = ts.transpileModule(extractedCopyHandlerSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
  reportDiagnostics: true,
})
const copyHandlerExtractionErrors = (extractedCopyHandler.diagnostics || []).filter((diagnostic) => (
  diagnostic.category === ts.DiagnosticCategory.Error
))
assert.equal(copyHandlerExtractionErrors.length, 0, '应能编译 AST 提取的真实复制 handler')

const createCopyHandler = new Function(
  'result',
  'loading',
  'product',
  'getAffiliateCapabilitySnapshot',
  'requestRevision',
  'currentGoodsIdRef',
  'isCurrentAffiliateCopyOperation',
  'refreshAffiliateCapabilities',
  'runAffiliatePurchaseCopyWorkflow',
  'hasAffiliateOfferChanged',
  'refreshConfirmationRequired',
  'Taro',
  'convert',
  'setRefreshConfirmationRequired',
  'showToast',
  'runAffiliateCopyIfCurrent',
  'isAffiliateLinkExpired',
  'isAffiliateCopyFallbackUsable',
  'setCopyFallback',
  'onClose',
  'setError',
  extractedCopyHandler.outputText,
)
const visibleCopyFallbackFactory = new Function(
  'copyFallback',
  'latestCopyIdentity',
  'isAffiliateCopyFallbackUsable',
  `return ${findComponentVariable('visibleCopyFallback')}`,
)

assert.match(couponPurchaseSheetSource, /isAffiliateCopyFallbackUsable/u)
assert.match(couponPurchaseSheetSource, /selectable/u, '复制失败时应提供可长按选择的文本')
assert.match(couponPurchaseSheetSource, /copyResult\.taobao_password \|\| copyResult\.coupon_url \|\| copyResult\.share_url/u)
assert.match(couponPurchaseSheetSource, /if \(outcome === 'copied' && isCurrentCopyOperation\(capturedIdentity\(\)\)\)/u)
assert.match(couponPurchaseSheetSource, /复制失败，可长按选择文本手动复制/u)
assert.match(couponPurchaseSheetSource, /try \{\s*const clipboardOperation = runAffiliateCopyIfCurrent/u)
assert.match(couponPurchaseSheetSource, /if \(isAffiliateLinkExpired\(copyResult\.expires_at\)\)[\s\S]*?const refreshedRequest = convert\(capturedGoodsId\)/u)

const copyIdentity = { requestRevision: 4, capabilityRevision: 8, goodsId: 'goods-1' }
const copyFallback = {
  text: '口令',
  expiresAt: new Date(now + 1000).toISOString(),
  identity: copyIdentity,
}
const enabledCapabilities = {
  enabled: true,
  search_enabled: true,
  resolve_enabled: true,
  convert_enabled: true,
}
assert.equal(isAffiliateCopyFallbackUsable(copyFallback, copyIdentity, enabledCapabilities, now), true)
assert.equal(isAffiliateCopyFallbackUsable(copyFallback, { ...copyIdentity, goodsId: 'goods-2' }, enabledCapabilities, now), false)
assert.equal(isAffiliateCopyFallbackUsable(copyFallback, { ...copyIdentity, requestRevision: 5 }, enabledCapabilities, now), false)
assert.equal(isAffiliateCopyFallbackUsable(copyFallback, { ...copyIdentity, capabilityRevision: 9 }, enabledCapabilities, now), false)
assert.equal(isAffiliateCopyFallbackUsable(copyFallback, copyIdentity, { ...enabledCapabilities, convert_enabled: false }, now), false)
assert.equal(isAffiliateCopyFallbackUsable(copyFallback, copyIdentity, enabledCapabilities, now + 1000), false)
assert.equal(isAffiliateCopyFallbackUsable({ ...copyFallback, expiresAt: 'invalid-date' }, copyIdentity, enabledCapabilities, now), false)
assert.equal(isAffiliateCopyFallbackUsable({ ...copyFallback, text: '  ' }, copyIdentity, enabledCapabilities, now), false)
assert.equal(isAffiliateCopyFallbackUsable({ ...copyFallback, expiresAt: null }, copyIdentity, enabledCapabilities, now), true)
assert.equal(isAffiliateCopyFallbackUsable(copyFallback, copyIdentity, enabledCapabilities, now + 1000), false)

assert.equal(isAffiliateLinkExpired(null, now), false)
assert.equal(isAffiliateLinkExpired('2026-10-15T12:00:01.000Z', now), false)
assert.equal(isAffiliateLinkExpired('2026-10-15T12:00:00.000Z', now), true)
assert.equal(isAffiliateLinkExpired('2026-10-15T11:59:59.000Z', now), true)
assert.equal(isAffiliateLinkExpired('invalid-date', now), true)

assert.equal(hasAffiliateOfferChanged(baseProduct, baseResult), false)
assert.equal(hasAffiliateOfferChanged(baseProduct, { ...baseResult, actual_price: '18.90' }), true)
assert.equal(hasAffiliateOfferChanged(baseProduct, { ...baseResult, coupon_amount: '4.00' }), true)
assert.equal(hasAffiliateOfferChanged(baseProduct, { ...baseResult, coupon_condition: '满 30 元可用' }), true)
for (const couponStatus of ['sold_out', 'expired', 'none', 'unknown'] as const) {
  assert.equal(
    hasAffiliateOfferChanged(baseProduct, { ...baseResult, coupon_status: couponStatus }),
    true,
    `active → ${couponStatus} must require offer confirmation even when amounts match`,
  )
}
assert.equal(
  hasAffiliateOfferChanged({ ...baseProduct, actual_price: undefined }, baseResult),
  false,
  '旧页面没有金额时不应虚构成金额变更',
)

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}
const deferred = <T,>(): Deferred<T> => {
  let resolvePromise!: (value: T) => void
  let rejectPromise!: (reason?: unknown) => void
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })
  return { promise, resolve: resolvePromise, reject: rejectPromise }
}

const createActualCopyHandlerHarness = (options: {
  result?: AffiliateConvertResult
  product?: AffiliatePurchaseProduct
  clipboard?: (text: string) => Promise<unknown>
  convert?: (goodsId: string) => Promise<AffiliateConvertResult | null>
} = {}) => {
  const result = options.result || baseResult
  const product = options.product || baseProduct
  let currentCapabilities = { ...enabledCapabilities }
  let capabilityRevision = copyIdentity.capabilityRevision
  const requestRevision = { current: copyIdentity.requestRevision }
  const currentGoodsIdRef: { current: string | undefined } = { current: product.goods_id }
  let copyFallback: AffiliateCopyFallback | null = null
  let refreshConfirmationRequired = false
  const toasts: Array<{ title: string; icon: string }> = []
  const clipboardTexts: string[] = []
  let closeCount = 0
  let error = ''
  const handlerFactory = createCopyHandler as (...args: unknown[]) => {
    copyConvertedLink: () => Promise<void>
  }
  const handler = handlerFactory(
    result,
    false,
    product,
    () => ({ revision: capabilityRevision, capabilities: currentCapabilities }),
    requestRevision,
    currentGoodsIdRef,
    isCurrentAffiliateCopyOperation,
    async () => undefined,
    runAffiliatePurchaseCopyWorkflow,
    hasAffiliateOfferChanged,
    false,
    {
      setClipboardData: ({ data }: { data: string }) => {
        clipboardTexts.push(data)
        return options.clipboard ? options.clipboard(data) : Promise.resolve()
      },
      showModal: async () => ({ confirm: true }),
    },
    options.convert || (async () => null),
    (required: boolean) => { refreshConfirmationRequired = required },
    (toast: { title: string; icon: string }) => { toasts.push(toast) },
    runAffiliateCopyIfCurrent,
    isAffiliateLinkExpired,
    isAffiliateCopyFallbackUsable,
    (next: typeof copyFallback) => { copyFallback = next as typeof copyFallback },
    () => { closeCount += 1 },
    (nextError: string) => { error = nextError },
  ) as { copyConvertedLink: () => Promise<void> }

  const latestCopyIdentity = () => ({
    identity: {
      requestRevision: requestRevision.current,
      capabilityRevision,
      goodsId: currentGoodsIdRef.current,
    },
    capabilities: currentCapabilities,
  })
  const visibleFallback = () => visibleCopyFallbackFactory(
    copyFallback,
    latestCopyIdentity(),
    isAffiliateCopyFallbackUsable,
  )

  return {
    copy: handler.copyConvertedLink,
    clipboardTexts,
    toasts,
    get fallback() { return copyFallback },
    get visibleFallback() { return visibleFallback() },
    get refreshConfirmationRequired() { return refreshConfirmationRequired },
    get closeCount() { return closeCount },
    get error() { return error },
    set capability(value: typeof currentCapabilities) { currentCapabilities = value },
    set capabilityRevision(value: number) { capabilityRevision = value },
    set goodsId(value: string | undefined) { currentGoodsIdRef.current = value },
    set requestRevision(value: number) { requestRevision.current = value },
    set fallback(value: typeof copyFallback) { copyFallback = value },
  }
}

const testActualCopyHandlerFallback = async () => {
  for (const [name, result, expectedText] of [
    ['口令优先', baseResult, '口令'],
    ['券链接次优先', { ...baseResult, taobao_password: '', coupon_url: 'https://example.com/coupon-only' }, 'https://example.com/coupon-only'],
    ['分享链接兜底', { ...baseResult, taobao_password: '', coupon_url: '', share_url: 'https://example.com/share-only' }, 'https://example.com/share-only'],
  ] as const) {
    const harness = createActualCopyHandlerHarness({
      result,
      clipboard: async () => { throw new Error('clipboard denied') },
    })
    await harness.copy()
    assert.deepEqual(harness.clipboardTexts, [expectedText], `${name}应沿用组件真实复制优先级`)
    assert.equal(harness.fallback?.text, expectedText, `${name}应由真实 handler 保存正确回退文本`)
    assert.equal(harness.visibleFallback?.text, expectedText, `${name}的真实渲染守卫应允许显示当前文本`)
    assert.ok(harness.toasts.some(({ title }) => title.includes('长按选择文本')), `${name}应提示手动复制`)
    assert.equal(harness.closeCount, 0, '剪贴板失败后不应关闭购买面板')
  }

  const clipboardOperation = deferred<unknown>()
  const clipboardStarted = deferred<void>()
  const stale = createActualCopyHandlerHarness({
    clipboard: async () => {
      clipboardStarted.resolve()
      return clipboardOperation.promise
    },
  })
  const staleCopy = stale.copy()
  await clipboardStarted.promise
  stale.goodsId = 'goods-2'
  stale.requestRevision = copyIdentity.requestRevision + 1
  clipboardOperation.reject(new Error('late clipboard failure'))
  await staleCopy
  assert.equal(stale.fallback, null, '商品或请求身份变化后旧 handler 不得保存回退文本')

  const capClipboard = deferred<unknown>()
  const capClipboardStarted = deferred<void>()
  const capabilityStale = createActualCopyHandlerHarness({
    clipboard: async () => {
      capClipboardStarted.resolve()
      return capClipboard.promise
    },
  })
  const capabilityCopy = capabilityStale.copy()
  await capClipboardStarted.promise
  capabilityStale.capability = { ...enabledCapabilities, enabled: false, convert_enabled: false }
  capabilityStale.capabilityRevision = copyIdentity.capabilityRevision + 1
  capabilityStale.capability = { ...enabledCapabilities }
  capabilityStale.capabilityRevision = copyIdentity.capabilityRevision + 2
  capClipboard.reject(new Error('late clipboard failure'))
  await capabilityCopy
  assert.equal(capabilityStale.fallback, null, '推广能力关闭再恢复后旧 handler 不得保存回退文本')

  const retained = createActualCopyHandlerHarness({
    clipboard: async () => { throw new Error('clipboard denied') },
  })
  await retained.copy()
  const visibleBeforeChange = retained.visibleFallback
  assert.equal(visibleBeforeChange?.text, '口令')
  retained.capability = { ...enabledCapabilities, enabled: false, convert_enabled: false }
  retained.capabilityRevision = copyIdentity.capabilityRevision + 1
  assert.equal(retained.visibleFallback, null, '能力关闭时真实渲染守卫应隐藏已有文本')
  retained.capability = { ...enabledCapabilities }
  retained.capabilityRevision = copyIdentity.capabilityRevision + 2
  assert.equal(retained.visibleFallback, null, '能力恢复后旧能力代的文本仍须隐藏')

  let currentTime = now
  const originalNow = Date.now
  Date.now = () => currentTime
  try {
    const expiringResult = { ...baseResult, expires_at: new Date(now + 1000).toISOString() }
    const refreshedResult = {
      ...baseResult,
      taobao_password: '刷新后的口令',
      expires_at: new Date(now + 60_000).toISOString(),
    }
    const pendingClipboard = deferred<unknown>()
    const pendingStarted = deferred<void>()
    let convertCount = 0
    const expired = createActualCopyHandlerHarness({
      result: expiringResult,
      clipboard: async () => {
        pendingStarted.resolve()
        return pendingClipboard.promise
      },
      convert: async (goodsId) => {
        assert.equal(goodsId, baseProduct.goods_id)
        convertCount += 1
        return refreshedResult
      },
    })
    const expiringCopy = expired.copy()
    await pendingStarted.promise
    currentTime = now + 1001
    pendingClipboard.reject(new Error('clipboard failed after link expiry'))
    await expiringCopy
    assert.equal(convertCount, 1, '复制等待期间过期后真实 handler 应刷新链接')
    assert.equal(expired.fallback, null, '已过期口令不得保存成可手动复制文本')
    assert.equal(expired.visibleFallback, null, '已过期口令不得进入可见回退区域')
    assert.equal(expired.refreshConfirmationRequired, true, '刷新结果须要求用户再次确认')
    assert.ok(expired.toasts.some(({ title }) => title.includes('请确认后复制')))
    assert.equal(expired.closeCount, 0)
  } finally {
    Date.now = originalNow
  }
}

const testExpiredDuringConfirmation = async () => {
  let currentTime = now
  const originalNow = Date.now
  Date.now = () => currentTime
  try {
    const oldResult = { ...baseResult, expires_at: new Date(now + 1000).toISOString() }
    const refreshedResult = {
      ...baseResult,
      taobao_password: '新的推广口令',
      expires_at: new Date(now + 60_000).toISOString(),
    }
    const confirmation = deferred<boolean>()
    const copied: string[] = []
    let confirmationCount = 0
    let refreshCount = 0
    let refreshedNoticeCount = 0
    const firstCopy = runAffiliatePurchaseCopyWorkflow({
      result: oldResult,
      requiresConfirmation: true,
      isCurrent: () => true,
      confirm: () => { confirmationCount += 1; return confirmation.promise },
      refresh: async () => { refreshCount += 1; return refreshedResult },
      onRefreshed: () => { refreshedNoticeCount += 1 },
      onRefreshExpired: () => undefined,
      copy: async (result) => { copied.push(result.taobao_password || ''); return true },
    })
    assert.equal(confirmationCount, 1, '组件应先等待用户确认展示的优惠')

    currentTime = now + 1001
    confirmation.resolve(true)
    assert.equal(await firstCopy, 'refreshed', '确认期间过期后应刷新并结束本次复制')
    assert.equal(refreshCount, 1)
    assert.equal(refreshedNoticeCount, 1)
    assert.deepEqual(copied, [], '刷新结果不得在首次确认后自动复制')

    const secondCopy = await runAffiliatePurchaseCopyWorkflow({
      result: refreshedResult,
      requiresConfirmation: true,
      isCurrent: () => true,
      confirm: async () => { confirmationCount += 1; return true },
      refresh: async () => { refreshCount += 1; return refreshedResult },
      onRefreshed: () => { refreshedNoticeCount += 1 },
      onRefreshExpired: () => undefined,
      copy: async (result) => { copied.push(result.taobao_password || ''); return true },
    })
    assert.equal(secondCopy, 'copied')
    assert.equal(confirmationCount, 2, '刷新结果必须由用户再次确认')
    assert.deepEqual(copied, ['新的推广口令'])

    const canceled = await runAffiliatePurchaseCopyWorkflow({
      result: refreshedResult,
      requiresConfirmation: true,
      isCurrent: () => true,
      confirm: async () => false,
      refresh: async () => refreshedResult,
      onRefreshed: () => undefined,
      onRefreshExpired: () => undefined,
      copy: async () => { copied.push('取消后不应复制'); return true },
    })
    assert.equal(canceled, 'cancelled')
    assert.deepEqual(copied, ['新的推广口令'])

    const delayedGuard = deferred<boolean>()
    let operationCurrent = true
    const staleCopy = runAffiliatePurchaseCopyWorkflow({
      result: refreshedResult,
      requiresConfirmation: true,
      isCurrent: () => operationCurrent,
      confirm: () => delayedGuard.promise,
      refresh: async () => refreshedResult,
      onRefreshed: () => undefined,
      onRefreshExpired: () => undefined,
      copy: async () => { copied.push('过时代次不应复制'); return true },
    })
    operationCurrent = false
    delayedGuard.resolve(true)
    assert.equal(await staleCopy, 'stale', '商品、请求或能力代次变化后不得复制')
    assert.deepEqual(copied, ['新的推广口令'])

    const failedClipboard = await runAffiliatePurchaseCopyWorkflow({
      result: refreshedResult,
      requiresConfirmation: false,
      isCurrent: () => true,
      confirm: async () => true,
      refresh: async () => refreshedResult,
      onRefreshed: () => undefined,
      onRefreshExpired: () => undefined,
      copy: async () => false,
    })
    assert.equal(failedClipboard, 'unavailable', '剪贴板失败不得进入已复制结果')
  } finally {
    Date.now = originalNow
  }
}

void testExpiredDuringConfirmation().then(testActualCopyHandlerFallback).then(() => {
  console.log('affiliate purchase policy and confirmation workflow smoke passed')
}).catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
