import type {
  AffiliateCatalogGroupKey,
  AffiliateCatalogItem,
  AffiliateCatalogTag,
} from '../../../api/affiliate'

/** AFFILIATE_CATALOG_DAILY_TAG_ORDER 固定日用细分顺序，并按键匹配后端元数据。 */
export const AFFILIATE_CATALOG_DAILY_TAG_ORDER = [
  'sanitary_pads',
  'tissues',
  'toothpaste',
  'laundry_detergent',
  'mouthwash',
  'body_wash',
  'laundry_beads',
  'condoms',
  'toilet_wipes',
  'pocket_tissues',
] as const

const dailyTagOrder = new Map<string, number>(
  AFFILIATE_CATALOG_DAILY_TAG_ORDER.map((key, index) => [key, index]),
)

/** shouldShowAffiliateCatalogLegacyFallback 仅在接口明确关闭商品库时启用旧推荐路径。 */
export const shouldShowAffiliateCatalogLegacyFallback = (enabled: boolean | null) => enabled === false

/** sortAffiliateCatalogDailyTags 只展示约定的十个日用标签，并沿用后端名称和数量。 */
export const sortAffiliateCatalogDailyTags = (tags: AffiliateCatalogTag[]) => (
  tags
    .filter((tag) => dailyTagOrder.has(tag.key))
    .sort((left, right) => (dailyTagOrder.get(left.key) ?? 0) - (dailyTagOrder.get(right.key) ?? 0))
)

/** appendUniqueAffiliateCatalogItems 按不透明 goods_id 去重，并保留首次出现顺序。 */
export const appendUniqueAffiliateCatalogItems = (
  current: AffiliateCatalogItem[],
  incoming: AffiliateCatalogItem[],
) => {
  const items = new Map(current.map((item) => [item.goods.goods_id, item]))
  incoming.forEach((item) => items.set(item.goods.goods_id, item))
  return Array.from(items.values())
}

/** getAffiliateCatalogSnapshotRestart 只对商品库指定的快照冲突回到同筛选第一页。 */
export const getAffiliateCatalogSnapshotRestart = (
  page: number,
  group: AffiliateCatalogGroupKey | undefined,
  tag: string | undefined,
  statusCode: number | undefined,
  errorCode: string | undefined,
) => (
  page > 1 && statusCode === 409 && errorCode === 'affiliate_catalog_snapshot_changed'
    ? { page: 1, group, tag }
    : null
)

/** hasMoreAffiliateCatalogPages 按服务端总数和页大小判断是否还有数据。 */
export const hasMoreAffiliateCatalogPages = (page: number, pageSize: number, total: number) => (
  page > 0 && pageSize > 0 && page * pageSize < total
)

/** formatAffiliateCatalogMonthSales 只格式化有效真实销量，未知或异常值不生成标签。 */
export const formatAffiliateCatalogMonthSales = (monthSales: number | null) => (
  monthSales !== null && Number.isFinite(monthSales) && Number.isInteger(monthSales) && monthSales >= 0
    ? `月销 ${monthSales}`
    : undefined
)

export type AffiliateCatalogRequestIdentity = {
  revision: number
  group?: AffiliateCatalogGroupKey
  tag?: string
  page: number
}

/** AffiliateCatalogRequestCoordinator 阻止旧筛选、隐藏页和关闭能力的请求提交状态。 */
export class AffiliateCatalogRequestCoordinator {
  private revision = 0
  private active = false
  private capabilityEnabled = false
  private current: AffiliateCatalogRequestIdentity | null = null

  /** setScope 在页面可见性或好物能力变化时使旧请求失效。 */
  setScope(active: boolean, capabilityEnabled: boolean) {
    if (this.active !== active || this.capabilityEnabled !== capabilityEnabled) {
      this.revision += 1
      this.current = null
    }
    this.active = active
    this.capabilityEnabled = capabilityEnabled
  }

  /** begin 为当前筛选与页码建立唯一响应身份。 */
  begin(group: AffiliateCatalogGroupKey | undefined, tag: string | undefined, page: number) {
    const identity = { revision: ++this.revision, group, tag, page }
    this.current = identity
    return identity
  }

  /** isCurrent 拒绝已被新筛选、分页或页面状态取代的响应。 */
  isCurrent(identity: AffiliateCatalogRequestIdentity) {
    return this.active
      && this.capabilityEnabled
      && this.current?.revision === identity.revision
      && this.current.group === identity.group
      && this.current.tag === identity.tag
      && this.current.page === identity.page
  }

  /** invalidate 使组件卸载后的请求不能产生状态副作用。 */
  invalidate() {
    this.revision += 1
    this.current = null
  }
}
