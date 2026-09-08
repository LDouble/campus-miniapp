export type MarketplaceCategory = {
  id: string
  name: string
  enabled: boolean
  sort_order: number
}

export const DEFAULT_MARKETPLACE_CATEGORIES: MarketplaceCategory[] = [
  { id: 'digital', name: '数码产品', enabled: true, sort_order: 10 },
  { id: 'books', name: '图书', enabled: true, sort_order: 20 },
  { id: 'course_material', name: '教材资料', enabled: true, sort_order: 30 },
  { id: 'daily_use', name: '生活用品', enabled: true, sort_order: 40 },
  { id: 'network_fee', name: '网费', enabled: true, sort_order: 50 },
  { id: 'clothing', name: '服饰鞋包', enabled: true, sort_order: 60 },
  { id: 'sports', name: '运动器材', enabled: true, sort_order: 70 },
  { id: 'general', name: '其他', enabled: true, sort_order: 100 },
]

const isRecord = (value: unknown): value is Record<string, unknown> => (
  !!value && typeof value === 'object' && !Array.isArray(value)
)

const isMarketplaceCategory = (value: unknown): value is MarketplaceCategory => (
  isRecord(value)
  && typeof value.id === 'string'
  && value.id.trim().length <= 32
  && /^[a-z0-9](?:[a-z0-9_]{0,30}[a-z0-9])?$/.test(value.id.trim())
  && typeof value.name === 'string'
  && value.name.trim().length > 0
  && value.name.length <= 64
  && typeof value.enabled === 'boolean'
  && typeof value.sort_order === 'number'
  && Number.isFinite(value.sort_order)
)

export const normalizeMarketplaceCategories = (value: unknown): MarketplaceCategory[] => {
  if (!Array.isArray(value)) return DEFAULT_MARKETPLACE_CATEGORIES
  const categories = value
    .filter(isMarketplaceCategory)
    .map((category) => ({
      id: category.id.trim(),
      name: category.name.trim(),
      enabled: category.enabled,
      sort_order: category.sort_order,
    }))
    .filter((category, index, all) => (
      all.findIndex((candidate) => candidate.id === category.id) === index
    ))
    .sort((left, right) => (
      left.sort_order - right.sort_order || left.id.localeCompare(right.id)
    ))
  return categories.length > 0 ? categories : DEFAULT_MARKETPLACE_CATEGORIES
}

export const enabledMarketplaceCategories = (categories: MarketplaceCategory[]) => (
  categories.filter((category) => category.enabled)
)
