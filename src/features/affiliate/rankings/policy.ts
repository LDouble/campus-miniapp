import type { AffiliateRankingCategory, AffiliateRankingItem } from '../../../api/affiliate'

/** AFFILIATE_RANKING_CATEGORY_ORDER 保存本轮确认的热销榜分类顺序。 */
export const AFFILIATE_RANKING_CATEGORY_ORDER = [4, 6, 3, 1, 14, 5, 9, 12, 13] as const

const includedCategoryIds = new Set<number>(AFFILIATE_RANKING_CATEGORY_ORDER)
const categoryOrder = new Map<number, number>(AFFILIATE_RANKING_CATEGORY_ORDER.map((id, index) => [id, index]))

/** sortAffiliateRankingCategories 只显示确认启用的9类并保留后端提供的分类名称。 */
export const sortAffiliateRankingCategories = (categories: AffiliateRankingCategory[]) => (
  categories
    .filter((category) => includedCategoryIds.has(category.id))
    .sort((left, right) => (categoryOrder.get(left.id) || 0) - (categoryOrder.get(right.id) || 0))
)

/** appendUniqueAffiliateRankingItems 按不透明 goods_id 精确去重榜单商品。 */
export const appendUniqueAffiliateRankingItems = (
  current: AffiliateRankingItem[],
  incoming: AffiliateRankingItem[],
) => {
  const items = new Map(current.map((item) => [item.goods.goods_id, item]))
  incoming.forEach((item) => items.set(item.goods.goods_id, item))
  return Array.from(items.values())
}

export type AffiliateRankingRequestIdentity = {
  revision: number
  categoryId?: number
  page: number
}

/** AffiliateRankingRequestCoordinator 让响应受页面可见性、能力和分类分页身份约束。 */
export class AffiliateRankingRequestCoordinator {
  private revision = 0
  private active = false
  private capabilityEnabled = false
  private current: AffiliateRankingRequestIdentity | null = null

  /** setScope 更新页面可见性和好物能力，失效不再适用的请求。 */
  setScope(active: boolean, capabilityEnabled: boolean) {
    if (this.active !== active || this.capabilityEnabled !== capabilityEnabled) {
      this.revision += 1
      this.current = null
    }
    this.active = active
    this.capabilityEnabled = capabilityEnabled
  }

  /** begin 为最新的分类与页码创建响应身份。 */
  begin(categoryId: number | undefined, page: number): AffiliateRankingRequestIdentity {
    const identity = { revision: ++this.revision, categoryId, page }
    this.current = identity
    return identity
  }

  /** isCurrent 拒绝页面隐藏、能力关闭或分类/页码已变化的旧响应。 */
  isCurrent(identity: AffiliateRankingRequestIdentity) {
    return this.active
      && this.capabilityEnabled
      && this.current?.revision === identity.revision
      && this.current.categoryId === identity.categoryId
      && this.current.page === identity.page
  }

  /** invalidate 使当前请求不能再提交页面副作用。 */
  invalidate() {
    this.revision += 1
    this.current = null
  }
}

/** getAffiliateRankingSnapshotRestart 仅在非第一页遇到409时回到同分类第一页。 */
export const getAffiliateRankingSnapshotRestart = (
  page: number,
  categoryId: number | undefined,
  statusCode: number | undefined,
) => (
  page > 1 && statusCode === 409
    ? { page: 1, categoryId }
    : null
)

/** hasMoreAffiliateRankingPages 按服务端总数和页大小判断是否存在后续页。 */
export const hasMoreAffiliateRankingPages = (page: number, pageSize: number, total: number) => (
  page > 0 && pageSize > 0 && page * pageSize < total
)

export type AffiliateRankingCategoryState = AffiliateRankingCategory['state'] | 'empty' | 'partial'

/** getAffiliateRankingCategoryState 聚合综合榜状态，保留单分类状态原值。 */
export const getAffiliateRankingCategoryState = (
  categories: AffiliateRankingCategory[],
  categoryId: number | undefined,
): AffiliateRankingCategoryState => {
  const selected = categoryId === undefined
    ? categories
    : categories.filter((category) => category.id === categoryId)
  if (selected.length === 0) return 'empty'
  if (categoryId !== undefined) return selected[0].state

  const states = new Set(selected.map((category) => category.state))
  if (states.size === 1) return selected[0].state
  if (states.has('ready') || states.has('stale')) return 'partial'
  if (states.has('pending')) return 'pending'
  return 'failed'
}

/** getAffiliateRankingCategoryTimestamp 返回当前分类或综合榜最近的有效更新时间。 */
export const getAffiliateRankingCategoryTimestamp = (
  categories: AffiliateRankingCategory[],
  categoryId: number | undefined,
) => {
  const selected = categoryId === undefined
    ? categories
    : categories.filter((category) => category.id === categoryId)
  return selected
    .map((category) => category.synced_at)
    .filter((value): value is string => value !== null && value.length > 0 && Number.isFinite(Date.parse(value)))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] || null
}
