import type { AffiliateGoods } from '../../api/affiliate'
import type { AffiliateResolutionGoods } from './resolution-ticket'

const MAX_CACHED_GOODS = 50
const goodsById = new Map<string, AffiliateResolutionGoods>()

/** 缓存当前会话中刚搜索或解析的商品，支持站内 goods_id 详情路由。 */
export const cacheAffiliateGoods = (goods: AffiliateGoods | AffiliateResolutionGoods) => {
  goodsById.delete(goods.goods_id)
  const goodsWithResolution = goods as AffiliateResolutionGoods
  let cachedGoods = goodsWithResolution
  if (Object.prototype.hasOwnProperty.call(goods, 'resolution_token')
    && (typeof goodsWithResolution.resolution_token !== 'string' || !goodsWithResolution.resolution_token.trim())) {
    cachedGoods = { ...goodsWithResolution }
    delete cachedGoods.resolution_token
  }
  goodsById.set(goods.goods_id, cachedGoods)
  if (goodsById.size > MAX_CACHED_GOODS) {
    const oldestGoodsId = goodsById.keys().next().value
    if (oldestGoodsId) goodsById.delete(oldestGoodsId)
  }
}

/** 读取当前会话的商品详情缓存；冷启动外部深链不依赖该缓存。 */
export const getCachedAffiliateGoods = (goodsId: string) => goodsById.get(goodsId)

/** clearAffiliateGoodsResolutionToken 仅清除仍匹配的失效凭证，避免覆盖同商品的新解析凭证。 */
export const clearAffiliateGoodsResolutionToken = (goodsId: string, resolutionToken: string) => {
  const cached = goodsById.get(goodsId)
  if (cached?.resolution_token !== resolutionToken) return false
  goodsById.set(goodsId, {
    ...cached,
    resolution_token: undefined,
    requires_resolution_token: true,
  })
  return true
}

/** clearAffiliateGoodsCache 在展示能力失效时清除当前会话的商品详情快照。 */
export const clearAffiliateGoodsCache = () => goodsById.clear()
