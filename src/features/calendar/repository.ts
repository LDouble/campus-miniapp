import Taro from '@tarojs/taro'
import { getAcademicCalendar } from '../../api/academic'
import type {
  AcademicCalendar,
  AcademicEducationLevel,
} from '../../api/types'
import { normalizeAcademicCalendar } from './utils'

export type CalendarLoadResult = {
  calendar: AcademicCalendar | null
  source: 'cache' | 'network' | 'unavailable'
  updatedAt: number
}

type StoredCalendar = {
  version: 1
  updatedAt: number
  value: AcademicCalendar
}

const STORAGE_PREFIX = 'campus.academicCalendar.v1.'
const LEVEL_KEY = 'campus.academicCalendar.educationLevel.v1'
export const ACADEMIC_CALENDAR_FRESH_MS = 30 * 60 * 1000

export type CalendarLoadOptions = {
  force?: boolean
}

const isEducationLevel = (value: unknown): value is AcademicEducationLevel => (
  value === 'undergraduate' || value === 'graduate'
)

const isCalendar = (
  value: unknown,
  level: AcademicEducationLevel,
): value is AcademicCalendar => {
  if (!value || typeof value !== 'object') return false
  const calendar = value as Partial<AcademicCalendar>
  return (
    calendar.education_level === level
    && typeof calendar.timezone === 'string'
    && typeof calendar.refreshed_at === 'string'
    && Array.isArray(calendar.terms)
    && Array.isArray(calendar.events)
  )
}

const storageKey = (level: AcademicEducationLevel) => `${STORAGE_PREFIX}${level}`

const readStored = (level: AcademicEducationLevel): StoredCalendar | null => {
  try {
    const stored = Taro.getStorageSync<StoredCalendar>(storageKey(level))
    if (
      stored
      && stored.version === 1
      && Number.isFinite(stored.updatedAt)
      && isCalendar(stored.value, level)
    ) {
      return {
        ...stored,
        value: normalizeAcademicCalendar(stored.value),
      }
    }
  } catch {
    // Corrupt or unavailable storage is treated as an empty cache.
  }
  return null
}

const writeStored = (
  level: AcademicEducationLevel,
  calendar: AcademicCalendar,
  updatedAt = Date.now(),
) => {
  const stored: StoredCalendar = {
    version: 1,
    updatedAt,
    value: calendar,
  }
  try {
    Taro.setStorageSync(storageKey(level), stored)
  } catch {
    // A successful network result should still be usable without storage.
  }
  return stored.updatedAt
}

export const getCalendarEducationLevel = (): AcademicEducationLevel => {
  try {
    const value = Taro.getStorageSync<AcademicEducationLevel>(LEVEL_KEY)
    if (isEducationLevel(value)) return value
  } catch {
    // Use the public undergraduate calendar by default.
  }
  return 'undergraduate'
}

export const saveCalendarEducationLevel = (level: AcademicEducationLevel) => {
  Taro.setStorageSync(LEVEL_KEY, level)
}

export const getCachedAcademicCalendar = (
  level = getCalendarEducationLevel(),
): CalendarLoadResult => {
  const stored = readStored(level)
  if (stored) {
    return {
      calendar: stored.value,
      source: 'cache',
      updatedAt: stored.updatedAt,
    }
  }
  return { calendar: null, source: 'unavailable', updatedAt: 0 }
}

type PendingCalendarRequest = {
  generation: number
  promise: Promise<CalendarLoadResult>
}

const pendingRequests = new Map<AcademicEducationLevel, PendingCalendarRequest>()
const cacheGenerations = new Map<AcademicEducationLevel, number>()
const invalidatedLevels = new Set<AcademicEducationLevel>()

const cacheGeneration = (level: AcademicEducationLevel) => (
  cacheGenerations.get(level) || 0
)

const isFresh = (updatedAt: number) => (
  Date.now() - updatedAt < ACADEMIC_CALENDAR_FRESH_MS
)

/**
 * 使指定校历在下一次读取时重新请求网络。
 *
 * 保留持久化数据作为弱网回退；已开始的旧请求不会写回新的 freshness。
 */
export const invalidateAcademicCalendar = (level?: AcademicEducationLevel) => {
  const levels: AcademicEducationLevel[] = level
    ? [level]
    : ['undergraduate', 'graduate']
  levels.forEach((item) => {
    cacheGenerations.set(item, cacheGeneration(item) + 1)
    invalidatedLevels.add(item)
    pendingRequests.delete(item)
  })
}

export const loadAcademicCalendar = (
  level = getCalendarEducationLevel(),
  options: CalendarLoadOptions = {},
): Promise<CalendarLoadResult> => {
  const existing = pendingRequests.get(level)
  if (existing && existing.generation === cacheGeneration(level)) return existing.promise

  const stored = readStored(level)
  if (!options.force && !invalidatedLevels.has(level) && stored && isFresh(stored.updatedAt)) {
    return Promise.resolve({
      calendar: stored.value,
      source: 'cache',
      updatedAt: stored.updatedAt,
    })
  }

  const generation = cacheGeneration(level)
  let tracked: Promise<CalendarLoadResult>
  tracked = getAcademicCalendar(level)
    .then((calendar) => {
      const normalized = normalizeAcademicCalendar(calendar)
      const updatedAt = Date.now()
      if (cacheGeneration(level) === generation) {
        writeStored(level, normalized, updatedAt)
        invalidatedLevels.delete(level)
      }
      return {
        calendar: normalized,
        source: 'network' as const,
        updatedAt,
      }
    })
    .catch(() => getCachedAcademicCalendar(level))
    .finally(() => {
      if (pendingRequests.get(level)?.promise === tracked) pendingRequests.delete(level)
    })
  pendingRequests.set(level, { generation, promise: tracked })
  return tracked
}
