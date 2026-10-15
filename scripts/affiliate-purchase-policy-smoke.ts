import { strict as assert } from 'node:assert'
import type { AffiliateConvertResult } from '../src/api/affiliate'
import type { AffiliatePurchaseProduct } from '../src/features/affiliate/components/product-card'
import {
  hasAffiliateOfferChanged,
  isAffiliateLinkExpired,
  runAffiliatePurchaseCopyWorkflow,
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

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void }
const deferred = <T,>(): Deferred<T> => {
  let resolvePromise!: (value: T) => void
  const promise = new Promise<T>((resolve) => { resolvePromise = resolve })
  return { promise, resolve: resolvePromise }
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
  } finally {
    Date.now = originalNow
  }
}

void testExpiredDuringConfirmation().then(() => {
  console.log('affiliate purchase policy and confirmation workflow smoke passed')
}).catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
