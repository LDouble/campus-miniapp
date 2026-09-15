import Taro from '@tarojs/taro'
import { apiRequest, createIdempotencyKey } from './client'
import type {
  PaymentStatusView,
  SettlementPayablePage,
  WithdrawalPage,
  WithdrawalSummary,
  WithdrawalView,
  WechatPayParams,
  ErrandPaymentPolicy,
} from './types'

export const getErrandPaymentPolicy = () => apiRequest<ErrandPaymentPolicy>({
  path: '/api/v1/errands/payment-policy',
})

export class WechatPaymentCancelledError extends Error {
  constructor() {
    super('用户取消支付')
    this.name = 'WechatPaymentCancelledError'
  }
}

export const isWechatPaymentCancelled = (error: unknown) => (
  error instanceof WechatPaymentCancelledError
)

export const queryTradeOrderPayment = (orderId: number) => (
  apiRequest<PaymentStatusView>({
    path: `/api/v1/orders/${orderId}/wechat-pay/query`,
    method: 'POST',
  })
)

const PAYMENT_ATTEMPT_TTL_MS = 10 * 60 * 1000
const paymentAttempts = new Map<number, { key: string; createdAt: number }>()

export const payTradeOrder = async (orderId: number) => {
  const now = Date.now()
  const existingAttempt = paymentAttempts.get(orderId)
  const attempt = existingAttempt && now - existingAttempt.createdAt < PAYMENT_ATTEMPT_TTL_MS
    ? existingAttempt
    : { key: createIdempotencyKey(`order:${orderId}:wechat-pay`), createdAt: now }
  paymentAttempts.set(orderId, attempt)
  let params: WechatPayParams
  try {
    params = await apiRequest<WechatPayParams>({
      path: `/api/v1/orders/${orderId}/wechat-pay`,
      method: 'POST',
      idempotencyKey: attempt.key,
    })
  } catch (error) {
    paymentAttempts.delete(orderId)
    throw error
  }
  let cancelled = false
  try {
    await Taro.requestPayment({
      timeStamp: params.time_stamp,
      nonceStr: params.nonce_str,
      package: params.package,
      signType: params.sign_type as never,
      paySign: params.pay_sign,
    })
  } catch (error) {
    const message = error && typeof error === 'object' && 'errMsg' in error
      ? String(error.errMsg)
      : String(error)
    cancelled = message.toLowerCase().includes('cancel')
  }
  let status: PaymentStatusView
  try {
    status = await queryTradeOrderPayment(orderId)
  } catch {
    throw new Error('支付结果确认中，请稍后刷新订单，请勿重复支付')
  }
  if (status.status === 'succeeded') {
    paymentAttempts.delete(orderId)
    return params.intent_no
  }
  if (cancelled && status.status === 'pending') throw new WechatPaymentCancelledError()
  throw new Error('支付结果确认中，请稍后刷新订单，请勿重复支付')
}

export const listMySettlementPayables = (
  status?: 'available' | 'transferring' | 'paid' | 'blocked',
  page = 1,
  pageSize = 20,
) => apiRequest<SettlementPayablePage>({
  path: '/api/v1/settlements/mine',
  query: { status, page, page_size: pageSize },
})

export const getMyWithdrawalSummary = () => apiRequest<WithdrawalSummary>({
  path: '/api/v1/withdrawals/summary',
})

export const listMyWithdrawals = (
  status?: WithdrawalView['status'],
  page = 1,
  pageSize = 20,
) => apiRequest<WithdrawalPage>({
  path: '/api/v1/withdrawals/mine',
  query: { status, page, page_size: pageSize },
})

export const getMyWithdrawal = (id: number) => apiRequest<WithdrawalView>({
  path: `/api/v1/withdrawals/${id}`,
})

export const createWithdrawal = (
  sceneKey: WithdrawalView['scene_key'],
  expectedAmountCents: number,
  expectedPayableCount: number,
) => apiRequest<WithdrawalView>({
  path: '/api/v1/withdrawals',
  method: 'POST',
  idempotencyKey: createIdempotencyKey(`withdrawal:${sceneKey}`),
  data: {
    scene_key: sceneKey,
    expected_amount_cents: expectedAmountCents,
    expected_payable_count: expectedPayableCount,
  },
})
