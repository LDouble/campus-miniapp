import Taro from '@tarojs/taro'
import { getAccessToken } from '../../api/auth'
import { apiRequest, createIdempotencyKey } from '../../api/client'
import { normalizeWechatSubscribeTemplateIds } from './template-ids'

let requesting = false
type WechatSubscribeOption = Parameters<typeof Taro.requestSubscribeMessage>[0]
type WechatOpenSettingOption = NonNullable<Parameters<typeof Taro.openSetting>[0]>

export type WechatSubscriptionResult = {
  accepted: boolean
  needsSettings: boolean
  requested: boolean
}

type StartedWechatSubscription = {
  requested: boolean
  result: Promise<WechatSubscriptionResult>
}

export type WechatSubscriptionSettings = {
  enabled: boolean
  mainSwitchOff: boolean
}

type WechatSubscriptionSettingsResult = {
  subscriptionsSetting?: {
    itemSettings?: Record<string, string>
    mainSwitch?: boolean
  }
}

const requestWechatSubscriptionMessage = (option: WechatSubscribeOption) => new Promise<Record<string, unknown>>((resolve, reject) => {
  let settled = false
  const settle = (callback: () => void) => {
    if (settled) return
    settled = true
    callback()
  }

  // 部分真机基础库会以回调模式实现该 API，调用本身不返回 Promise。
  // 因此不能直接在返回值上链式调用 then/catch。
  try {
    const request = Taro.requestSubscribeMessage({
      ...option,
      success: (result) => settle(() => resolve(result as Record<string, unknown>)),
      fail: (error) => settle(() => reject(error)),
    })
    // 有些基础库同时返回 Promise；显式处理拒绝，避免其成为未处理异常。
    void Promise.resolve(request).catch((error) => settle(() => reject(error)))
  } catch (error) {
    settle(() => reject(error))
  }
})

const subscriptionNeedsSettings = (error: unknown) => {
  if (!error || typeof error !== 'object') return false
  const result = error as { errCode?: unknown; errMsg?: unknown }
  return Number(result.errCode) === 20004
    || String(result.errMsg || '').includes('main switch is switched off')
}

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
const startWechatSubscription = (configuredTemplateIds: unknown): StartedWechatSubscription => {
  const templateIds = normalizeWechatSubscribeTemplateIds(configuredTemplateIds)
  if (
    process.env.TARO_ENV !== 'weapp'
    || requesting
    || templateIds.length === 0
    || !getAccessToken()
  ) return {
    requested: false,
    result: Promise.resolve({ accepted: false, needsSettings: false, requested: false }),
  }
  requesting = true
  // Taro 的跨平台类型错误地要求 entityIds；微信小程序运行时只接受 tmplIds。
  const option = { tmplIds: templateIds } as unknown as WechatSubscribeOption
  return {
    requested: true,
    result: requestWechatSubscriptionMessage(option)
      .then((result) => {
        const normalizedResult = result as Record<string, unknown>
        recordAcceptedTemplateIds(templateIds, normalizedResult)
        return {
          accepted: templateIds.some((id) => normalizedResult[id] === 'accept'),
          needsSettings: templateIds.some((id) => normalizedResult[id] === 'ban'),
          requested: true,
        }
      })
      .catch((error) => ({
        accepted: false,
        needsSettings: subscriptionNeedsSettings(error),
        requested: true,
      }))
      .finally(() => {
        requesting = false
      }),
  }
}

export const requestWechatSubscriptionWithResult = (configuredTemplateIds: unknown) => (
  startWechatSubscription(configuredTemplateIds).result
)

export const requestWechatSubscription = (configuredTemplateIds: unknown) => {
  const request = startWechatSubscription(configuredTemplateIds)
  void request.result
  return request.requested
}

export const getWechatSubscriptionSettings = async (
  configuredTemplateIds: unknown,
): Promise<WechatSubscriptionSettings> => {
  if (process.env.TARO_ENV !== 'weapp') return { enabled: false, mainSwitchOff: false }
  try {
    const result = await Taro.getSetting({ withSubscriptions: true }) as WechatSubscriptionSettingsResult
    const settings = result.subscriptionsSetting
    const templateIds = normalizeWechatSubscribeTemplateIds(configuredTemplateIds)
    const itemSettings = settings?.itemSettings || {}
    return {
      // 不能因某一模板已开启就屏蔽其余模板的引导；必须逐个核对运行时配置。
      enabled: templateIds.length > 0 && templateIds.every((id) => itemSettings[id] === 'accept'),
      mainSwitchOff: settings?.mainSwitch === false,
    }
  } catch {
    return { enabled: false, mainSwitchOff: false }
  }
}

export const openWechatSubscriptionSettings = async () => {
  if (process.env.TARO_ENV !== 'weapp') return false
  return new Promise<boolean>((resolve) => {
    let settled = false
    const settle = (opened: boolean) => {
      if (settled) return
      settled = true
      resolve(opened)
    }

    try {
      const option: WechatOpenSettingOption = {
        // 微信官方 API：true 时设置面板会展示订阅消息设置。
        withSubscriptions: true,
        success: () => settle(true),
        fail: () => settle(false),
      }
      const request = Taro.openSetting(option)
      // 新版基础库会返回 Promise，旧版则只走 success/fail 回调。
      if (request && typeof (request as Promise<unknown>).then === 'function') {
        void Promise.resolve(request).then(
          () => settle(true),
          () => settle(false),
        )
      }
    } catch {
      settle(false)
    }
  })
}
