import type { AffiliateGoods } from '../../api/affiliate'

const MAX_CACHED_GOODS = 50
const goodsById = new Map<string, AffiliateGoods>()

/** 缓存当前会话中刚搜索或解析的商品，支持站内 goods_id 详情路由。 */
export const cacheAffiliateGoods = (goods: AffiliateGoods) => {
  goodsById.delete(goods.goods_id)
  goodsById.set(goods.goods_id, goods)
  if (goodsById.size > MAX_CACHED_GOODS) {
    const oldestGoodsId = goodsById.keys().next().value
    if (oldestGoodsId) goodsById.delete(oldestGoodsId)
  }
}

/** 读取当前会话的商品详情缓存；冷启动外部深链不依赖该缓存。 */
export const getCachedAffiliateGoods = (goodsId: string) => goodsById.get(goodsId)
