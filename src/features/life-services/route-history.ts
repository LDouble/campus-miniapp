import Taro from '@tarojs/taro'
import { normalizeRouteValues } from './route-history-values'

export { normalizeRouteValues } from './route-history-values'

export type RouteHistoryKind = 'origin' | 'destination'

export const ROUTE_SHORTCUTS = [
  '崂山校区',
  '鱼山校区',
  '西海岸',
  '浮山校区',
  '机场',
  '青岛北',
  '青岛站',
] as const

const STORAGE_KEY = 'campus.lifeServices.routeHistory.v1'
type RouteHistory = Record<RouteHistoryKind, string[]>

const emptyHistory = (): RouteHistory => ({ origin: [], destination: [] })

const readHistory = (): RouteHistory => {
  const stored = Taro.getStorageSync<Partial<RouteHistory>>(STORAGE_KEY)
  if (!stored || typeof stored !== 'object') return emptyHistory()
  return {
    origin: normalizeRouteValues(stored.origin),
    destination: normalizeRouteValues(stored.destination),
  }
}

export const getRecentRouteValues = (kind: RouteHistoryKind) => readHistory()[kind]

export const rememberRouteValue = (kind: RouteHistoryKind, value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return
  const current = readHistory()
  const next = normalizeRouteValues([trimmed, ...current[kind]])
  Taro.setStorageSync(STORAGE_KEY, { ...current, [kind]: next })
}

export const rememberRoutePair = (origin: string, destination: string) => {
  rememberRouteValue('origin', origin)
  rememberRouteValue('destination', destination)
}
