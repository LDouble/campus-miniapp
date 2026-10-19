import { ApiError, apiRequest } from '../../api/client'
import type { components } from '../../api/generated/schema'

export type AffiliateShortcutDocument = components['schemas']['AffiliateShortcutDocument']
export type AffiliateShortcutItem = components['schemas']['AffiliateShortcutItem']
export type AffiliateShortcutAction = components['schemas']['AffiliateShortcutAction']
export type AffiliateShortcutCopy = components['schemas']['AffiliateShortcutCopy']

const isRecord = (value: unknown): value is Record<string, unknown> => (
  !!value && typeof value === 'object' && !Array.isArray(value)
)

const isNonEmptyString = (value: unknown, maxLength = Number.POSITIVE_INFINITY): value is string => (
  typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength
)

const isHttpsUrl = (value: unknown): value is string => (
  typeof value === 'string'
  && value.length <= 2048
  && /^https:\/\/[^\s/?#]+(?:[/?#][^\s]*)?$/i.test(value)
)

const isOptionalDateTime = (value: unknown) => (
  value === undefined || (
    typeof value === 'string'
    && value.length <= 64
    && /^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
    && Number.isFinite(Date.parse(value))
  )
)

const hasOnlyKeys = (value: Record<string, unknown>, keys: string[]) => (
  Object.keys(value).every((key) => keys.includes(key))
)

const isShortcutCopy = (value: unknown): value is AffiliateShortcutCopy => {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    'page_title', 'hero_image_url', 'title', 'description', 'steps',
    'target_app', 'content', 'button_text', 'success_text',
  ])) return false
  return isNonEmptyString(value.page_title, 32)
    && isNonEmptyString(value.title, 48)
    && (value.description === undefined || (typeof value.description === 'string' && value.description.length <= 200))
    && (value.hero_image_url === undefined || isHttpsUrl(value.hero_image_url))
    && Array.isArray(value.steps)
    && value.steps.length >= 1
    && value.steps.length <= 10
    && value.steps.every((step) => isNonEmptyString(step, 100))
    && isNonEmptyString(value.target_app, 40)
    && isNonEmptyString(value.content, 2048)
    && isNonEmptyString(value.button_text, 24)
    && isNonEmptyString(value.success_text, 48)
}

const isShortcutAction = (value: unknown): value is AffiliateShortcutAction => {
  if (!isRecord(value)) return false
  if (value.type === 'copy_token') {
    return hasOnlyKeys(value, ['type', 'copy']) && isShortcutCopy(value.copy)
  }
  if (value.type === 'mini_program') {
    return hasOnlyKeys(value, ['type', 'app_id', 'path', 'env_version'])
      && typeof value.app_id === 'string'
      && /^wx[0-9a-f]{16}$/.test(value.app_id)
      && isNonEmptyString(value.path, 1024)
      && !value.path.startsWith('/')
      && !/[#\\]/.test(value.path)
      && !/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value.path)
      && (value.env_version === 'develop'
        || value.env_version === 'trial'
        || value.env_version === 'release')
  }
  return false
}

const isShortcutItem = (value: unknown): value is AffiliateShortcutItem => {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    'id', 'title', 'icon_url', 'badge', 'enabled', 'priority', 'start_at', 'end_at', 'action',
  ])) return false
  return typeof value.id === 'string'
    && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value.id)
    && isNonEmptyString(value.title, 32)
    && isHttpsUrl(value.icon_url)
    && (value.badge === undefined || (typeof value.badge === 'string' && value.badge.length <= 16))
    && typeof value.enabled === 'boolean'
    && typeof value.priority === 'number'
    && Number.isInteger(value.priority)
    && value.priority >= 0
    && value.priority <= 1000000
    && isOptionalDateTime(value.start_at)
    && isOptionalDateTime(value.end_at)
    && isShortcutAction(value.action)
}

/** parseAffiliateShortcutDocument 校验公开入口配置，异常配置整体不执行。 */
export const parseAffiliateShortcutDocument = (
  value: unknown,
): AffiliateShortcutDocument | null => {
  let document = value
  if (typeof value === 'string') {
    try {
      document = JSON.parse(value) as unknown
    } catch {
      return null
    }
  }
  if (
    !isRecord(document)
    || !hasOnlyKeys(document, ['schema_version', 'items'])
    || document.schema_version !== 1
    || !Array.isArray(document.items)
    || document.items.length > 30
    || !document.items.every(isShortcutItem)
  ) {
    return null
  }
  const items = document.items as AffiliateShortcutItem[]
  if (new Set(items.map((item) => item.id)).size !== items.length) return null
  return document as unknown as AffiliateShortcutDocument
}

const idOrder = (left: AffiliateShortcutItem, right: AffiliateShortcutItem) => (
  left.id < right.id ? -1 : left.id > right.id ? 1 : 0
)

/** isAffiliateShortcutActive 判断入口当前是否启用且处于展示时间窗内。 */
export const isAffiliateShortcutActive = (
  item: AffiliateShortcutItem,
  now = Date.now(),
) => (
  item.enabled
  && Number.isFinite(now)
  && (!item.start_at || Date.parse(item.start_at) <= now)
  && (!item.end_at || now < Date.parse(item.end_at))
)

/** visibleAffiliateShortcuts 过滤未启用或未到展示时间的入口并稳定排序。 */
export const visibleAffiliateShortcuts = (
  document: AffiliateShortcutDocument | null,
  now = Date.now(),
): AffiliateShortcutItem[] => {
  if (!document || !Number.isFinite(now)) return []
  return document.items
    .filter((item) => isAffiliateShortcutActive(item, now))
    .sort((left, right) => right.priority - left.priority || idOrder(left, right))
    .slice(0, 30)
}

/** nextAffiliateShortcutBoundary 返回下一次需要重新计算展示状态的时间点。 */
export const nextAffiliateShortcutBoundary = (
  document: AffiliateShortcutDocument | null,
  now = Date.now(),
): number | null => {
  if (!document || !Number.isFinite(now)) return null
  const boundaries = document.items.flatMap((item) => [item.start_at, item.end_at])
    .filter((value): value is string => typeof value === 'string')
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value) && value > now)
  return boundaries.length ? Math.min(...boundaries) : null
}

/** loadAffiliateShortcutDocument 每次直接读取公开配置，不使用本地快照。 */
export const loadAffiliateShortcutDocument = async (): Promise<AffiliateShortcutDocument | null> => {
  let runtimeConfig: components['schemas']['RuntimeConfig']
  try {
    runtimeConfig = await apiRequest<components['schemas']['RuntimeConfig']>({
      path: '/api/v1/runtime-configs/affiliate_shortcuts/settings',
      anonymous: true,
    })
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 404) return null
    throw error
  }
  return parseAffiliateShortcutDocument(runtimeConfig.value)
}

/** getCurrentAffiliateShortcut 从服务端重读并按当前时刻复核入口状态。 */
export const getCurrentAffiliateShortcut = async (
  id: string,
  now?: number,
): Promise<AffiliateShortcutItem | null> => {
  const document = await loadAffiliateShortcutDocument()
  const validatedAt = now === undefined ? Date.now() : now
  return visibleAffiliateShortcuts(document, validatedAt).find((item) => item.id === id) || null
}

/** isSafeAffiliateShortcutImage 判断外部图片是否可以交给小程序加载。 */
export const isSafeAffiliateShortcutImage = (value?: string) => isHttpsUrl(value)
