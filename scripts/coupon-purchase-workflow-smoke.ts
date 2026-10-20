import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts = require('typescript')
import { canUseAffiliateCapability, type AffiliateCapabilities } from '../src/features/affiliate/capability-policy'
import {
  createAffiliateCopyOperationLock,
  runAffiliateCopyOperationExclusive,
  runAffiliateConversionAfterRefresh,
  type AffiliateCopySessionIdentity,
  type AffiliateConversionIdentity,
} from '../src/features/affiliate/purchase-policy'

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
assert.match(couponPurchaseSheetSource, /copyInFlight \|\| !convertEnabled/u, '复制处理中应有可见禁用状态')
assert.match(couponPurchaseSheetSource, /copyInFlight \? '正在处理…'/u, '复制处理中应展示忙碌文案')

const extractedConvert = ts.transpileModule(
  `const convert = ${findComponentVariable('convert')}; return convert`,
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

const runCopyLockScenarios = async () => {
  const lock = createAffiliateCopyOperationLock()
  const session: AffiliateCopySessionIdentity = {
    generation: 1,
    goodsId: 'goods-a',
    capabilityRevision: 3,
  }
  let currentSession = session
  const visibleLockStates: Array<AffiliateCopySessionIdentity | null> = []
  const isCurrentSession = (identity: AffiliateCopySessionIdentity) => (
    identity.generation === currentSession.generation
    && identity.goodsId === currentSession.goodsId
    && identity.capabilityRevision === currentSession.capabilityRevision
  )

  const operation = deferred<string>()
  const firstSideEffects: string[] = []
  const first = runAffiliateCopyOperationExclusive(
    lock,
    session,
    isCurrentSession,
    (identity) => { visibleLockStates.push(identity) },
    async () => {
      firstSideEffects.push('refresh-capabilities')
      return operation.promise
    },
  )
  const repeated = await runAffiliateCopyOperationExclusive(
    lock,
    session,
    isCurrentSession,
    (identity) => { visibleLockStates.push(identity) },
    async () => {
      firstSideEffects.push('duplicate-side-effect')
      return 'duplicate'
    },
  )
  assert.equal(repeated.started, false, '同一商品和代次的快速重复点击必须同步拦截')
  assert.deepEqual(firstSideEffects, ['refresh-capabilities'], '重复点击不得重复刷新、确认或复制流程')
  assert.deepEqual(visibleLockStates, [session], '开始完整复制流程时应立即展示忙碌状态')

  operation.resolve('copied')
  assert.deepEqual(await first, { started: true, value: 'copied' })
  assert.deepEqual(visibleLockStates, [session, null], '成功完成后应释放可见状态')

  const failed = deferred<void>()
  const failedRun = runAffiliateCopyOperationExclusive(
    lock,
    session,
    isCurrentSession,
    (identity) => { visibleLockStates.push(identity) },
    () => failed.promise,
  )
  failed.reject(new Error('capability refresh failed'))
  await assert.rejects(failedRun, /capability refresh failed/u)
  assert.equal(lock.owner, null, '刷新、确认或剪贴板流程抛错后也必须释放锁')
  assert.equal(visibleLockStates.at(-1), null, '失败完成后应释放可见状态')

  const oldOperation = deferred<void>()
  const newOperation = deferred<void>()
  const oldRun = runAffiliateCopyOperationExclusive(
    lock,
    session,
    isCurrentSession,
    (identity) => { visibleLockStates.push(identity) },
    () => oldOperation.promise,
  )

  currentSession = { generation: 2, goodsId: 'goods-b', capabilityRevision: 3 }
  const changedProductSession = currentSession
  const newRun = runAffiliateCopyOperationExclusive(
    lock,
    changedProductSession,
    isCurrentSession,
    (identity) => { visibleLockStates.push(identity) },
    () => newOperation.promise,
  )
  assert.equal(lock.owner?.identity.generation, changedProductSession.generation)
  oldOperation.resolve()
  await oldRun
  assert.equal(
    visibleLockStates.at(-1),
    changedProductSession,
    '旧商品流程结束时不得清除新商品的忙碌状态',
  )
  assert.equal(lock.owner?.identity.generation, changedProductSession.generation)

  currentSession = { generation: 3, goodsId: undefined, capabilityRevision: 3 }
  assert.equal(isCurrentSession(changedProductSession), false, '关闭购买面板应立即使旧商品流程失效')
  currentSession = { generation: 4, goodsId: 'goods-a', capabilityRevision: 3 }
  const reopenedSession = currentSession
  const reopenedOperation = deferred<void>()
  const reopenedRun = runAffiliateCopyOperationExclusive(
    lock,
    reopenedSession,
    isCurrentSession,
    (identity) => { visibleLockStates.push(identity) },
    () => reopenedOperation.promise,
  )
  assert.equal(lock.owner?.identity.generation, reopenedSession.generation, '关闭后重新打开相同商品也应使用新代次')
  newOperation.resolve()
  await newRun
  assert.equal(
    visibleLockStates.at(-1),
    reopenedSession,
    '旧代次 finally 不得清除重新打开后的忙碌状态',
  )
  reopenedOperation.resolve()
  await reopenedRun
  assert.equal(lock.owner, null)
  assert.equal(visibleLockStates.at(-1), null)

  currentSession = { generation: 5, goodsId: 'goods-a', capabilityRevision: 4 }
  const capabilityChangedSession = currentSession
  const capabilityOperation = deferred<void>()
  const capabilityRun = runAffiliateCopyOperationExclusive(
    lock,
    capabilityChangedSession,
    isCurrentSession,
    (identity) => { visibleLockStates.push(identity) },
    () => capabilityOperation.promise,
  )
  assert.equal(isCurrentSession(reopenedSession), false, '能力 revision 改变应使旧流程失效')
  capabilityOperation.resolve()
  await capabilityRun
}

const runConversionRevisionScenarios = async () => {
  let current: AffiliateConversionIdentity = {
    requestRevision: 8,
    capabilityRevision: 12,
    goodsId: 'goods-a',
  }
  const capabilities = { convertEnabled: true }
  const capture = { ...current }
  let convertCount = 0
  const refresh = deferred<typeof capabilities>()
  const pending = runAffiliateConversionAfterRefresh({
    captured: capture,
    getCurrent: () => current,
    refreshCapabilities: () => refresh.promise,
    canConvert: (value) => value.convertEnabled,
    convert: async () => { convertCount += 1; return 'converted' },
  })

  // 复现 refresh Promise 已返回、但 React capability 更新 effect 尚未触发的窗口。
  current = { ...current, capabilityRevision: 13 }
  refresh.resolve(capabilities)
  assert.deepEqual(await pending, { kind: 'stale' })
  assert.equal(convertCount, 0, '能力 revision 已变化时必须在真实转链 POST 前取消旧请求')

  current = { requestRevision: 9, capabilityRevision: 13, goodsId: 'goods-a' }
  const requestCapture = { ...current }
  let refreshCount = 0
  let currentConvertCount = 0
  const conversion = await runAffiliateConversionAfterRefresh({
    captured: requestCapture,
    getCurrent: () => current,
    refreshCapabilities: async () => { refreshCount += 1; return capabilities },
    canConvert: (value) => value.convertEnabled,
    convert: async () => { currentConvertCount += 1; return 'ok' },
  })
  assert.deepEqual(conversion, { kind: 'converted', value: 'ok' })
  assert.equal(refreshCount, 1)
  assert.equal(currentConvertCount, 1, '当前代次应在能力刷新后正常调用转链')

  for (const changedIdentity of [
    { ...requestCapture, requestRevision: requestCapture.requestRevision + 1 },
    { ...requestCapture, goodsId: 'goods-b' },
  ]) {
    current = requestCapture
    let localConvertCount = 0
    const changeDuringRefresh = runAffiliateConversionAfterRefresh({
      captured: requestCapture,
      getCurrent: () => current,
      refreshCapabilities: async () => {
        current = changedIdentity
        return capabilities
      },
      canConvert: (value) => value.convertEnabled,
      convert: async () => { localConvertCount += 1; return 'stale' },
    })
    assert.deepEqual(await changeDuringRefresh, { kind: 'stale' })
    assert.equal(localConvertCount, 0, '关闭或切换商品后旧 refresh 不得触发转链请求')
  }

  await assert.rejects(runAffiliateConversionAfterRefresh({
    captured: requestCapture,
    getCurrent: () => current,
    refreshCapabilities: async () => { throw new Error('bootstrap failed') },
    canConvert: (value) => value.convertEnabled,
    convert: async () => 'must not run',
  }), /bootstrap failed/u)
}

type CapabilitySnapshot = { revision: number; capabilities: AffiliateCapabilities }

const createActualConvertHarness = (refreshCapabilities: () => Promise<CapabilitySnapshot>, convert?: (goodsId: string) => Promise<string>) => {
  let snapshot: CapabilitySnapshot = {
    revision: 12,
    capabilities: {
      enabled: true,
      search_enabled: true,
      resolve_enabled: true,
      convert_enabled: true,
    },
  }
  const requestRevision = { current: 0 }
  const currentGoodsIdRef: { current: string | undefined } = { current: 'goods-a' }
  const currentResolutionTokenRef: { current: string | null | undefined } = { current: undefined }
  const requiresResolutionTokenRef = { current: false }
  const convertedGoods: string[] = []
  const state = { loading: false, error: '', result: null as string | null }
  const convertHandler = (createConvert as (...args: unknown[]) => (product: { goods_id: string }) => Promise<string | null>)(
    <T,>(callback: T) => callback,
    requestRevision,
    () => snapshot,
    currentGoodsIdRef,
    currentResolutionTokenRef,
    requiresResolutionTokenRef,
    (value: boolean) => { state.loading = value },
    (value: string) => { state.error = value },
    () => undefined,
    (value: string) => { state.result = value },
    () => undefined,
    () => undefined,
    runAffiliateConversionAfterRefresh,
    canUseAffiliateCapability,
    refreshCapabilities,
    async (goodsId: string) => {
      convertedGoods.push(goodsId)
      return convert ? convert(goodsId) : 'converted'
    },
    async () => 'resolution-converted',
    () => null,
    () => 'repaste',
    () => false,
    { current: undefined },
  )
  const runConvert = (goodsId: string) => convertHandler({ goods_id: goodsId })
  return {
    convert: runConvert,
    convertedGoods,
    state,
    requestRevision,
    currentGoodsIdRef,
    get snapshot() { return snapshot },
    set snapshot(value: CapabilitySnapshot) { snapshot = value },
  }
}

const runActualComponentConversionScenarios = async () => {
  assert.match(couponPurchaseSheetSource, /runAffiliateConversionAfterRefresh\(/u)

  const pendingCapabilityRefresh = deferred<CapabilitySnapshot>()
  const capabilityChanged = createActualConvertHarness(() => pendingCapabilityRefresh.promise)
  const delayedConversion = capabilityChanged.convert('goods-a')
  capabilityChanged.snapshot = {
    ...capabilityChanged.snapshot,
    revision: capabilityChanged.snapshot.revision + 1,
  }
  pendingCapabilityRefresh.resolve(capabilityChanged.snapshot)
  assert.equal(await delayedConversion, null)
  assert.deepEqual(
    capabilityChanged.convertedGoods,
    [],
    '能力 revision 在 refresh 完成后变化、React effect 尚未执行时，组件也不得发出转链 POST',
  )
  assert.equal(
    await capabilityChanged.convert('goods-a'),
    'converted',
    '新 capability revision 的 effect 应能重新发起当前商品转链',
  )
  assert.deepEqual(capabilityChanged.convertedGoods, ['goods-a'])

  for (const invalidation of [
    { kind: 'close', apply: (harness: ReturnType<typeof createActualConvertHarness>) => { harness.currentGoodsIdRef.current = undefined } },
    { kind: 'product change', apply: (harness: ReturnType<typeof createActualConvertHarness>) => { harness.currentGoodsIdRef.current = 'goods-b' } },
    { kind: 'request replacement', apply: (harness: ReturnType<typeof createActualConvertHarness>) => { harness.requestRevision.current += 1 } },
  ]) {
    const pending = deferred<CapabilitySnapshot>()
    const harness = createActualConvertHarness(() => pending.promise)
    const request = harness.convert('goods-a')
    invalidation.apply(harness)
    pending.resolve(harness.snapshot)
    assert.equal(await request, null, `${invalidation.kind}后旧刷新应停止`)
    assert.deepEqual(harness.convertedGoods, [], `${invalidation.kind}后不得发送旧商品转链请求`)
  }

  const normal = createActualConvertHarness(async () => ({
    revision: 12,
    capabilities: {
      enabled: true,
      search_enabled: true,
      resolve_enabled: true,
      convert_enabled: true,
    },
  }))
  assert.equal(await normal.convert('goods-a'), 'converted')
  assert.deepEqual(normal.convertedGoods, ['goods-a'])
  assert.equal(normal.state.result, 'converted')
  assert.equal(normal.state.loading, false)

  const failed = createActualConvertHarness(
    async () => ({
      revision: 12,
      capabilities: {
        enabled: true,
        search_enabled: true,
        resolve_enabled: true,
        convert_enabled: true,
      },
    }),
    async () => { throw new Error('conversion failed') },
  )
  assert.equal(await failed.convert('goods-a'), null)
  assert.equal(failed.state.error, 'conversion failed')
  assert.deepEqual(failed.convertedGoods, ['goods-a'])
  assert.equal(failed.state.loading, false)
}

void runCopyLockScenarios()
  .then(runConversionRevisionScenarios)
  .then(runActualComponentConversionScenarios)
  .then(() => {
  console.log('coupon purchase copy lock and conversion generation smoke passed')
}).catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
