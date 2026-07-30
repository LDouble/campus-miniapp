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
) => {
  const stored: StoredCalendar = {
    version: 1,
    updatedAt: Date.now(),
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

const pendingRequests = new Map<AcademicEducationLevel, Promise<CalendarLoadResult>>()

export const loadAcademicCalendar = (
  level = getCalendarEducationLevel(),
): Promise<CalendarLoadResult> => {
  const existing = pendingRequests.get(level)
  if (existing) return existing

  let tracked: Promise<CalendarLoadResult>
  tracked = getAcademicCalendar(level)
    .then((calendar) => {
      const normalized = normalizeAcademicCalendar(calendar)
      return {
        calendar: normalized,
        source: 'network' as const,
        updatedAt: writeStored(level, normalized),
      }
    })
    .catch(() => getCachedAcademicCalendar(level))
    .finally(() => {
      if (pendingRequests.get(level) === tracked) pendingRequests.delete(level)
    })
  pendingRequests.set(level, tracked)
  return tracked
}
