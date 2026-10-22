import { strict as assert } from 'node:assert'
import {
  applyAffiliateRequestIfCurrent,
  canUseAffiliateCapability,
  hasAffiliateCapabilitiesChanged,
  isCurrentAffiliateCopyOperation,
  isCurrentAffiliateRequest,
  normalizeAffiliateCapabilities,
  runAffiliateCopyIfCurrent,
} from '../src/features/affiliate/capability-policy'

const disabled = normalizeAffiliateCapabilities(undefined)
assert.deepEqual(disabled, {
  enabled: false,
  search_enabled: false,
  resolve_enabled: false,
  convert_enabled: false,
})

const enabledWithoutSearch = normalizeAffiliateCapabilities({
  enabled: true,
  search_enabled: false,
  resolve_enabled: true,
  convert_enabled: false,
})
assert.equal(canUseAffiliateCapability(enabledWithoutSearch, 'search'), false)
assert.equal(canUseAffiliateCapability(enabledWithoutSearch, 'resolve'), true)
assert.equal(canUseAffiliateCapability(enabledWithoutSearch, 'convert'), false)

const inconsistent = normalizeAffiliateCapabilities({
  enabled: false,
  search_enabled: true,
  resolve_enabled: true,
  convert_enabled: true,
})
assert.equal(canUseAffiliateCapability(inconsistent, 'search'), false)
assert.equal(canUseAffiliateCapability(inconsistent, 'resolve'), false)
assert.equal(canUseAffiliateCapability(inconsistent, 'convert'), false)
assert.equal(hasAffiliateCapabilitiesChanged(enabledWithoutSearch, disabled), true)
assert.equal(hasAffiliateCapabilitiesChanged(disabled, normalizeAffiliateCapabilities(undefined)), false)

const enabledForAsyncTests = normalizeAffiliateCapabilities({
  enabled: true,
  search_enabled: true,
  resolve_enabled: true,
  convert_enabled: true,
})
assert.equal(isCurrentAffiliateRequest(4, 4, 12, 12, enabledForAsyncTests), true)
assert.equal(isCurrentAffiliateRequest(5, 4, 13, 12, enabledForAsyncTests), false)
assert.equal(isCurrentAffiliateRequest(4, 4, 13, 12, enabledForAsyncTests), false)
assert.equal(isCurrentAffiliateRequest(4, 4, 12, 12, disabled), false)

let detailRequestRevision = 1
let detailCapabilityRevision = 12
let visibleDetail = '初始详情'
let detailStateWrites = 0
const oldDetail = new Promise<string>((resolve) => {
  setTimeout(() => resolve('旧商品详情'), 0)
})
const oldDetailCommit = oldDetail.then((value) => applyAffiliateRequestIfCurrent(
  detailRequestRevision,
  1,
  detailCapabilityRevision,
  12,
  enabledForAsyncTests,
  () => {
    visibleDetail = value
    detailStateWrites += 1
  },
))
detailRequestRevision = 2
detailCapabilityRevision = 13
const currentDetailCommit = applyAffiliateRequestIfCurrent(
  detailRequestRevision,
  2,
  detailCapabilityRevision,
  13,
  enabledForAsyncTests,
  () => {
    visibleDetail = '当前商品详情'
    detailStateWrites += 1
  },
)
assert.equal(currentDetailCommit, true)

const copyIdentity = { requestRevision: 7, capabilityRevision: 12, goodsId: 'goods-a' }
assert.equal(isCurrentAffiliateCopyOperation(copyIdentity, copyIdentity, enabledForAsyncTests), true)
assert.equal(isCurrentAffiliateCopyOperation(
  { ...copyIdentity, requestRevision: 8 }, copyIdentity, enabledForAsyncTests,
), false)

const clipboardAfterConfirmation = async (
  getCurrent: () => { identity: typeof copyIdentity; capabilities: typeof enabledForAsyncTests },
  capturedIdentity: typeof copyIdentity,
  confirm: Promise<boolean>,
  onCopy: () => void,
) => {
  if (await confirm) {
    const current = getCurrent()
    runAffiliateCopyIfCurrent(current.identity, capturedIdentity, current.capabilities, onCopy)
  }
}
const deferredConfirmation = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

const changedProductConfirmation = deferredConfirmation<boolean>()
let changedProductClipboardCalls = 0
let changedProductState = { identity: copyIdentity, capabilities: enabledForAsyncTests }
const changedProductCopy = clipboardAfterConfirmation(
  () => changedProductState,
  copyIdentity,
  changedProductConfirmation.promise,
  () => { changedProductClipboardCalls += 1 },
)
changedProductState = { ...changedProductState, identity: { ...copyIdentity, goodsId: 'goods-b' } }
changedProductConfirmation.resolve(true)

const toggledCapabilityConfirmation = deferredConfirmation<boolean>()
let toggledCapabilityClipboardCalls = 0
let toggledCapabilityState = { identity: copyIdentity, capabilities: enabledForAsyncTests }
const toggledCapabilityCopy = clipboardAfterConfirmation(
  () => toggledCapabilityState,
  copyIdentity,
  toggledCapabilityConfirmation.promise,
  () => { toggledCapabilityClipboardCalls += 1 },
)
toggledCapabilityState = {
  identity: { ...copyIdentity, capabilityRevision: 14 },
  capabilities: enabledForAsyncTests,
}
toggledCapabilityConfirmation.resolve(true)

const disabledConfirmation = deferredConfirmation<boolean>()
let disabledClipboardCalls = 0
let disabledState = { identity: copyIdentity, capabilities: enabledForAsyncTests }
const disabledCopy = clipboardAfterConfirmation(
  () => disabledState,
  copyIdentity,
  disabledConfirmation.promise,
  () => { disabledClipboardCalls += 1 },
)
disabledState = { identity: copyIdentity, capabilities: disabled }
disabledConfirmation.resolve(true)

const successfulConfirmation = deferredConfirmation<boolean>()
let successfulClipboardCalls = 0
const successfulCopy = clipboardAfterConfirmation(
  () => ({ identity: copyIdentity, capabilities: enabledForAsyncTests }),
  copyIdentity,
  successfulConfirmation.promise,
  () => { successfulClipboardCalls += 1 },
)
successfulConfirmation.resolve(true)

let currentGenerationClipboardCalls = 0
const currentGenerationCopy = runAffiliateCopyIfCurrent(
  copyIdentity,
  copyIdentity,
  enabledForAsyncTests,
  () => { currentGenerationClipboardCalls += 1 },
)
assert.equal(currentGenerationCopy, undefined)
assert.equal(currentGenerationClipboardCalls, 1)
assert.equal(isCurrentAffiliateCopyOperation(
  { ...copyIdentity, capabilityRevision: 14 }, copyIdentity, enabledForAsyncTests,
), false)
assert.equal(isCurrentAffiliateCopyOperation(
  { ...copyIdentity, goodsId: 'goods-b' }, copyIdentity, enabledForAsyncTests,
), false)
assert.equal(isCurrentAffiliateCopyOperation(
  { ...copyIdentity, goodsId: null }, copyIdentity, enabledForAsyncTests,
), false)
assert.equal(isCurrentAffiliateCopyOperation(
  copyIdentity,
  copyIdentity,
  normalizeAffiliateCapabilities({
    enabled: true,
    search_enabled: true,
    resolve_enabled: true,
    convert_enabled: false,
  }),
), false)

const runAsyncAssertions = async () => {
  await Promise.all([
    oldDetailCommit,
    changedProductCopy,
    toggledCapabilityCopy,
    disabledCopy,
    successfulCopy,
  ])
  assert.equal(visibleDetail, '当前商品详情')
  assert.equal(detailStateWrites, 1)
  assert.equal(changedProductClipboardCalls, 0)
  assert.equal(toggledCapabilityClipboardCalls, 0)
  assert.equal(disabledClipboardCalls, 0)
  assert.equal(successfulClipboardCalls, 1)
  console.log('affiliate capability and stale-operation policy smoke passed')
}

void runAsyncAssertions().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
