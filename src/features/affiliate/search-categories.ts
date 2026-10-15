/** 固定的大淘客官方一级分类；与 Campus 好物推荐分类相互独立。 */
export const AFFILIATE_GOODS_SEARCH_CATEGORIES = [
  { id: 1, label: '女装' },
  { id: 2, label: '母婴' },
  { id: 3, label: '美妆' },
  { id: 4, label: '居家日用' },
  { id: 5, label: '鞋品' },
  { id: 6, label: '美食' },
  { id: 7, label: '文娱车品' },
  { id: 8, label: '数码家电' },
  { id: 9, label: '男装' },
  { id: 10, label: '内衣' },
  { id: 11, label: '箱包' },
  { id: 12, label: '配饰' },
  { id: 13, label: '户外运动' },
  { id: 14, label: '家装家纺' },
] as const

export type AffiliateGoodsSearchCategoryId = (typeof AFFILIATE_GOODS_SEARCH_CATEGORIES)[number]['id']

/** 检查分类是否属于大淘客搜索接口支持的固定一级分类。 */
export const isAffiliateGoodsSearchCategoryId = (
  value: number,
): value is AffiliateGoodsSearchCategoryId => (
  AFFILIATE_GOODS_SEARCH_CATEGORIES.some((category) => category.id === value)
)
