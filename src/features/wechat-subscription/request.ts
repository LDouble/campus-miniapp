import Taro from '@tarojs/taro'
import { getAccessToken } from '../../api/auth'
import { apiRequest, createIdempotencyKey } from '../../api/client'
import { normalizeWechatSubscribeTemplateIds } from './template-ids'

let requesting = false
type WechatSubscribeOption = Parameters<typeof Taro.requestSubscribeMessage>[0]

const recordAcceptedTemplateIds = (
  templateIds: string[],
  result: Record<string, unknown>,
) => {
  const acceptedTemplateIds = templateIds.filter((id) => result[id] === 'accept')
  if (acceptedTemplateIds.length === 0) return
  void apiRequest({
    path: '/api/v1/notices/subscriptions',
    method: 'POST',
    data: { template_ids: acceptedTemplateIds },
    idempotencyKey: createIdempotencyKey('notice-subscription'),
  }).catch(() => undefined)
}

// 必须在用户点击的同步调用链内发起；只将微信明确同意的模板异步登记。
export const requestWechatSubscription = (configuredTemplateIds: unknown) => {
  const templateIds = normalizeWechatSubscribeTemplateIds(configuredTemplateIds)
  if (
    process.env.TARO_ENV !== 'weapp'
    || requesting
    || templateIds.length === 0
    || !getAccessToken()
  ) return
  requesting = true
  // Taro 的跨平台类型错误地要求 entityIds；微信小程序运行时只接受 tmplIds。
  const option = { tmplIds: templateIds } as unknown as WechatSubscribeOption
  void Taro.requestSubscribeMessage(option)
    .then((result) => recordAcceptedTemplateIds(
      templateIds,
      result as Record<string, unknown>,
    ))
    .catch(() => undefined)
    .finally(() => {
      requesting = false
    })
}
