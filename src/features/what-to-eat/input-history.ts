import Taro from '@tarojs/taro'

export type FoodInputHistory = {
  categories: string[]
  locations: string[]
  tags: string[]
}

export type FoodInputHistoryInput = Partial<FoodInputHistory>

const STORAGE_KEY_PREFIX = 'what-to-eat.input-history.v1'
const MAX_HISTORY_ITEMS = 8

export const DEFAULT_FOOD_CATEGORIES = ['快餐', '面食', '米饭', '小吃', '烧烤', '饮品']
export const DEFAULT_FOOD_TAGS = ['早餐', '午餐', '晚餐', '夜宵', '性价比', '不用排队']
export const FOOD_CATEGORY_MAX_LENGTH = 32

const defaultLocationsByCampus: Record<string, string[]> = {
  崂山校区: ['北区食堂', '南区食堂', '西区食堂', '校外美食街'],
  鱼山校区: ['鱼山食堂', '校外美食街'],
  西海岸校区: ['校内食堂', '校外美食街'],
  浮山校区: ['校内食堂', '校外餐饮'],
  三亚校区: ['校内食堂', '校外餐饮'],
}

const emptyHistory = (): FoodInputHistory => ({ categories: [], locations: [], tags: [] })

const storageKey = (campus: string) => `${STORAGE_KEY_PREFIX}.${encodeURIComponent(campus || 'default')}`

const normalizeItems = (items: unknown, limit = MAX_HISTORY_ITEMS) => {
  if (!Array.isArray(items)) return []
  return items.reduce<string[]>((result, item) => {
    const value = typeof item === 'string' ? item.trim() : ''
    if (!value || result.includes(value) || result.length >= limit) return result
    result.push(value)
    return result
  }, [])
}

const normalizeHistory = (value: unknown): FoodInputHistory => {
  const source = value && typeof value === 'object' ? value as Partial<FoodInputHistory> : {}
  return {
    categories: normalizeItems(source.categories),
    locations: normalizeItems(source.locations),
    tags: normalizeItems(source.tags),
  }
}

const prependItems = (existing: string[], incoming?: string[]) => normalizeItems([
  ...(incoming || []),
  ...existing,
])

export const getDefaultFoodLocations = (campus: string) => (
  defaultLocationsByCampus[campus] || ['校内食堂', '校外餐饮']
)

export const loadFoodInputHistory = (campus: string): FoodInputHistory => {
  try {
    return normalizeHistory(Taro.getStorageSync(storageKey(campus)))
  } catch {
    return emptyHistory()
  }
}

export const rememberFoodInputHistory = (
  campus: string,
  input: FoodInputHistoryInput,
): FoodInputHistory => {
  const current = loadFoodInputHistory(campus)
  const next: FoodInputHistory = {
    categories: prependItems(current.categories, input.categories),
    locations: prependItems(current.locations, input.locations),
    tags: prependItems(current.tags, input.tags),
  }
  try {
    Taro.setStorageSync(storageKey(campus), next)
  } catch {
    // Local shortcuts are optional; submitting a listing must not depend on storage availability.
  }
  return next
}
