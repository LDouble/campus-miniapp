import Taro from '@tarojs/taro'
import { apiRequest, createIdempotencyKey } from './client'
import type {
  MerchantTransferView,
  PaymentStatusView,
  SettlementPayablePage,
  WechatPayParams,
} from './types'

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

export const payTradeOrder = async (orderId: number) => {
  const params = await apiRequest<WechatPayParams>({
    path: `/api/v1/orders/${orderId}/wechat-pay`,
    method: 'POST',
    idempotencyKey: createIdempotencyKey(`order:${orderId}:wechat-pay`),
  })
	let cancelled = false
	try {
		await Taro.requestPayment({
			timeStamp: params.time_stamp,
			nonceStr: params.nonce_str,
			package: params.package,
			signType: params.sign_type,
			paySign: params.pay_sign,
		})
	} catch (error) {
		const message = error && typeof error === 'object' && 'errMsg' in error
			? String(error.errMsg)
			: String(error)
		cancelled = message.toLowerCase().includes('cancel')
		if (!cancelled) throw error
	}
	const status = await queryTradeOrderPayment(orderId)
	if (status.status === 'succeeded') return params.intent_no
	if (cancelled) throw new WechatPaymentCancelledError()
	throw new Error('支付结果确认中，请稍后刷新订单')
}

export const listMySettlementPayables = (
  status?: 'available' | 'transferring' | 'paid' | 'blocked',
  page = 1,
  pageSize = 20,
) => apiRequest<SettlementPayablePage>({
  path: '/api/v1/settlements/mine',
  query: { status, page, page_size: pageSize },
})

export const transferSettlementPayable = (id: number, expectedVersion: number) => (
  apiRequest<MerchantTransferView>({
    path: `/api/v1/settlements/${id}/transfer`,
    method: 'POST',
    idempotencyKey: createIdempotencyKey(`settlement:${id}:transfer`),
    data: { expected_version: expectedVersion },
  })
)
