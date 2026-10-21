/** MEMBER_AD_UNIT_ID 是会员广告浮层使用的微信原生模板广告单元。 */
export const MEMBER_AD_UNIT_ID = 'adunit-4f79eb2b54ba62ae'

type WechatAdApi = {
  preloadAd?: (ads: Array<{ unitId: string; type: 'custom' }>) => void | Promise<unknown>
}

/** preloadMemberAd 尝试预热广告数据；展示资格仍以组件的 load 事件为准。 */
export const preloadMemberAd = (
  api = (globalThis as typeof globalThis & { wx?: WechatAdApi }).wx,
) => {
  if (typeof api?.preloadAd !== 'function') return false
  try {
    const result = api.preloadAd([{ unitId: MEMBER_AD_UNIT_ID, type: 'custom' }])
    // 兼容返回 Promise 的桥接实现，预加载失败不影响首页及组件正常加载。
    if (result) void Promise.resolve(result).catch(() => {})
    return true
  } catch {
    return false
  }
}
