import { apiRequest } from './client'
import type { components, operations } from './generated/schema'

export type AffiliateProduct = components['schemas']['AffiliateProductView']
export type AffiliateProductPage = components['schemas']['AffiliateProductPage']
export type AffiliateGoods = components['schemas']['AffiliateGoodsView']
export type AffiliateGoodsPage = components['schemas']['AffiliateGoodsPage']
export type AffiliateTaxonomy = components['schemas']['AffiliateTaxonomyView']
export type AffiliateConvertResult = components['schemas']['AffiliateConvertResult']
export type AffiliateResolveResult = components['schemas']['AffiliateResolveResult']
export type AffiliateGoodsSearchSort = NonNullable<operations['SearchAffiliateGoods']['parameters']['query']['sort']>
export type AffiliateGoodsSearchFilters = Pick<
  operations['SearchAffiliateGoods']['parameters']['query'],
  'has_coupon' | 'min_price' | 'max_price' | 'sort'
>

export type AffiliateProductQuery = {
  page?: number
  pageSize?: number
  categoryId?: number
  topicId?: number
}

const normalizePage = (value?: number) => (
  Number.isInteger(value) && value && value > 0 ? value : 1
)

const normalizePageSize = (value?: number) => (
  Number.isInteger(value) && value && value > 0 ? Math.min(value, 50) : 20
)

/** 查询服务端人工发布且当前有效的好物。 */
export const listAffiliateProducts = (query: AffiliateProductQuery = {}) => (
  apiRequest<AffiliateProductPage>({
    path: '/api/v1/affiliate/products',
    query: {
      page: normalizePage(query.page),
      page_size: normalizePageSize(query.pageSize),
      category_id: query.categoryId,
      topic_id: query.topicId,
    },
  })
)

/** 按本地推荐商品 id 获取详情。 */
export const getAffiliateProduct = (id: number) => apiRequest<AffiliateProduct>({
  path: `/api/v1/affiliate/products/${id}`,
})

/** 按关键词、筛选和排序搜索上游商品库。 */
export const searchAffiliateGoods = (
  keyword: string,
  page = 1,
  filters: AffiliateGoodsSearchFilters = {},
) => (
  apiRequest<AffiliateGoodsPage>({
    path: '/api/v1/affiliate/search',
    query: {
      keyword: keyword.trim(),
      page: normalizePage(page),
      page_size: 20,
      has_coupon: filters.has_coupon,
      min_price: filters.min_price,
      max_price: filters.max_price,
      sort: filters.sort,
    },
  })
)

/** 解析用户主动粘贴的淘宝商品分享内容，不持久化原始内容。 */
export const resolveAffiliateContent = (content: string) => (
  apiRequest<AffiliateResolveResult>({
    path: '/api/v1/affiliate/resolve',
    method: 'POST',
    data: { content: content.trim() },
  })
)

/** 使用服务端当前推广位生成商品推广链接。 */
export const convertAffiliateGoods = (goodsId: string) => (
  apiRequest<AffiliateConvertResult>({
    path: '/api/v1/affiliate/convert',
    method: 'POST',
    data: { goods_id: goodsId },
  })
)

/** 查询已启用的好物分类。 */
export const listAffiliateCategories = () => (
  apiRequest<{ items: AffiliateTaxonomy[] }>({ path: '/api/v1/affiliate/categories' })
)

/** 查询已启用的好物专题。 */
export const listAffiliateTopics = () => (
  apiRequest<{ items: AffiliateTaxonomy[] }>({ path: '/api/v1/affiliate/topics' })
)
