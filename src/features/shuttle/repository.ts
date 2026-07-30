import Taro from '@tarojs/taro'
import { apiRequest } from '../../api/client'
import type { components } from '../../api/generated/schema'

export type ShuttleRoute = components['schemas']['ShuttleRouteView']
type ShuttleRoutePage = components['schemas']['ShuttleRouteViewPage']

export type ShuttleQuery = {
  campus?: string
  serviceType?: 'campus_loop' | 'intercampus'
  date?: string
}

export type ShuttleLoadResult = {
  items: ShuttleRoute[]
  source: 'network' | 'cache' | 'unavailable'
  updatedAt: number
}

type StoredShuttleRoutes = {
  version: 1
  items: ShuttleRoute[]
  updatedAt: number
}

const STORAGE_KEY = 'campus.shuttle.routes.v1'

const dateKey = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const isRoute = (value: unknown): value is ShuttleRoute => {
  if (!value || typeof value !== 'object') return false
  const route = value as Partial<ShuttleRoute>
  return (
    typeof route.id === 'number'
    && typeof route.name === 'string'
    && typeof route.origin === 'string'
    && typeof route.destination === 'string'
    && Array.isArray(route.campuses)
    && Array.isArray(route.stops)
    && Array.isArray(route.schedules)
    && !!route.resolved_schedule
  )
}

const readCache = (): StoredShuttleRoutes | null => {
  try {
    const stored = Taro.getStorageSync<StoredShuttleRoutes>(STORAGE_KEY)
    if (
      stored
      && stored.version === 1
      && Array.isArray(stored.items)
      && stored.items.every(isRoute)
    ) return stored
  } catch {
    // Invalid local data is ignored so callers can render a real empty state.
  }
  return null
}

const mergeCache = (items: ShuttleRoute[]) => {
  const previous = readCache()?.items || []
  const byID = new Map(previous.map((item) => [item.id, item]))
  items.forEach((item) => byID.set(item.id, item))
  const stored: StoredShuttleRoutes = {
    version: 1,
    items: Array.from(byID.values()),
    updatedAt: Date.now(),
  }
  try {
    Taro.setStorageSync(STORAGE_KEY, stored)
  } catch {
    // A successful request should still render when storage is unavailable.
  }
  return stored.updatedAt
}

const filterRoutes = (items: ShuttleRoute[], query: ShuttleQuery) => items.filter((item) => (
  (!query.serviceType || item.service_type === query.serviceType)
  && (!query.campus || item.campuses.includes(query.campus))
))

const queryDate = (value?: string) => {
  if (!value || value === dateKey(new Date())) return new Date()
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? new Date() : date
}

const routeScheduleForDate = (route: ShuttleRoute, date: Date) => {
  const target = dateKey(date)
  const override = route.date_overrides.find((item) => item.service_date === target)
  const period = route.special_periods.find((item) => (
    item.start_date <= target && item.end_date >= target
  ))
  const weekend = date.getDay() === 0 || date.getDay() === 6
  const dayType = override?.day_type
    || period?.day_type
    || (weekend ? 'weekend' : 'workday')
  const weekly = route.schedules.find((item) => item.day_type === dayType)
  const departureTimes = override?.departure_times
    || period?.departure_times
    || weekly?.departure_times
    || []
  return {
    service_date: target,
    day_type: dayType,
    source: override
      ? 'date_override'
      : period
        ? 'special_period'
        : 'weekly_rule',
    suspended: Boolean(override?.suspended || period?.suspended || departureTimes.length === 0),
    departure_times: departureTimes,
    note: override?.note || period?.note || weekly?.note,
  } as const
}

const resolveCachedRoute = (
  route: ShuttleRoute,
  value?: string,
): ShuttleRoute => {
  const serviceDate = queryDate(value)
  const schedule = routeScheduleForDate(route, serviceDate)
  let next: string | undefined
  const now = new Date()
  for (let offset = 0; offset <= 14 && !next; offset += 1) {
    const date = new Date(serviceDate)
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() + offset)
    const candidate = routeScheduleForDate(route, date)
    if (candidate.suspended) continue
    for (const clock of candidate.departure_times) {
      const [hours, minutes] = clock.split(':').map(Number)
      const departure = new Date(date)
      departure.setHours(hours, minutes, 0, 0)
      if (departure.getTime() >= now.getTime()) {
        next = departure.toISOString()
        break
      }
    }
  }
  return {
    ...route,
    resolved_schedule: {
      ...schedule,
      next_departure_at: next,
    },
  }
}

const fallbackRoutes = (query: ShuttleQuery): ShuttleLoadResult => {
  const cached = readCache()
  if (cached?.items.length) {
    return {
      items: filterRoutes(
        cached.items.map((item) => resolveCachedRoute(item, query.date)),
        query,
      ),
      source: 'cache',
      updatedAt: cached.updatedAt,
    }
  }
  return {
    items: [],
    source: 'unavailable',
    updatedAt: 0,
  }
}

export const loadShuttleRoutes = async (
  query: ShuttleQuery = {},
): Promise<ShuttleLoadResult> => {
  try {
    const page = await apiRequest<ShuttleRoutePage>({
      path: '/api/v1/shuttle/routes',
      query: {
        campus: query.campus,
        date: query.date,
        page: 1,
        page_size: 100,
        service_type: query.serviceType,
      },
    })
    const updatedAt = mergeCache(page.items)
    return { items: page.items, source: 'network', updatedAt }
  } catch {
    return fallbackRoutes(query)
  }
}

export const loadShuttleRoute = async (
  id: number,
  date?: string,
): Promise<{ item: ShuttleRoute | null; source: ShuttleLoadResult['source'] }> => {
  try {
    const item = await apiRequest<ShuttleRoute>({
      path: `/api/v1/shuttle/routes/${id}`,
      query: { date },
    })
    mergeCache([item])
    return { item, source: 'network' }
  } catch {
    const cached = readCache()?.items.find((item) => item.id === id)
    if (cached) return { item: resolveCachedRoute(cached, date), source: 'cache' }
    return { item: null, source: 'unavailable' }
  }
}

export const shuttleDateKey = dateKey
