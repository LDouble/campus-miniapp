import Taro from '@tarojs/taro'
import {
  AcademicQueryChannel,
  getAcademicQueryChannel,
} from '../../features/academic-direct/channel'
import {
  AcademicPeriod,
  AcademicPreferences,
  Course,
  GradeSimulation,
} from './types'

const CUSTOM_COURSES_KEY = 'academic.customCourses.v1'
const PREFERENCES_KEY = 'academic.preferences.v1'
const GRADE_SIMULATION_KEY = 'academic.gradeSimulation.v1'
const SCHEDULE_CACHE_KEY_PREFIX = 'academic.scheduleCache.v1.'

export interface AcademicScheduleCache {
  version: 2
  platformUserId: number
  channel: AcademicQueryChannel
  periods: AcademicPeriod[]
  coursesByPeriod: Record<string, Course[]>
}

const safeRead = <T>(key: string, fallback: T): T => {
  try {
    return Taro.getStorageSync<T>(key) || fallback
  } catch (error) {
    return fallback
  }
}

const safeWrite = <T>(key: string, value: T) => {
  try {
    Taro.setStorageSync(key, value)
  } catch (error) {
    Taro.showToast({ title: '本地保存失败，请稍后重试', icon: 'none' })
  }
}

const validPeriod = (value: unknown): value is AcademicPeriod => {
  if (!value || typeof value !== 'object') return false
  const period = value as AcademicPeriod
  return (
    typeof period.id === 'string'
    && !!period.id
    && typeof period.label === 'string'
    && typeof period.shortLabel === 'string'
    && typeof period.startDate === 'string'
    && Number.isInteger(period.weeks)
    && period.weeks > 0
    && typeof period.isCurrent === 'boolean'
  )
}

const validCourse = (value: unknown): value is Course => {
  if (!value || typeof value !== 'object') return false
  const course = value as Course
  return (
    typeof course.id === 'string'
    && typeof course.periodId === 'string'
    && typeof course.name === 'string'
    && typeof course.teacher === 'string'
    && typeof course.location === 'string'
    && (course.campus === undefined || typeof course.campus === 'string')
    && Number.isInteger(course.weekday)
    && Number.isInteger(course.startSection)
    && Number.isInteger(course.endSection)
    && Array.isArray(course.weeks)
    && course.weeks.every((week) => Number.isInteger(week))
    && typeof course.color === 'string'
    && course.source === 'official'
  )
}

const scheduleCacheKey = (
  platformUserId: number,
  channel: AcademicQueryChannel,
) => (
  `${SCHEDULE_CACHE_KEY_PREFIX}${platformUserId}.${channel}`
)

const validScheduleCache = (
  value: unknown,
  platformUserId: number,
  channel: AcademicQueryChannel,
): value is AcademicScheduleCache => {
  if (!value || typeof value !== 'object') return false
  const cache = value as AcademicScheduleCache
  return (
    cache.version === 2
    && cache.platformUserId === platformUserId
    && cache.channel === channel
    && Array.isArray(cache.periods)
    && cache.periods.every(validPeriod)
    && !!cache.coursesByPeriod
    && typeof cache.coursesByPeriod === 'object'
    && Object.values(cache.coursesByPeriod).every((courses) => (
      Array.isArray(courses) && courses.every(validCourse)
    ))
  )
}

export const academicStorage = {
  getCustomCourses: () => safeRead<Course[]>(CUSTOM_COURSES_KEY, []),
  setCustomCourses: (courses: Course[]) => safeWrite(CUSTOM_COURSES_KEY, courses),
  getPreferences: (fallback: AcademicPreferences) => (
    safeRead<AcademicPreferences>(PREFERENCES_KEY, fallback)
  ),
  setPreferences: (preferences: AcademicPreferences) => (
    safeWrite(PREFERENCES_KEY, preferences)
  ),
  getGradeSimulations: () => (
    safeRead<Record<string, GradeSimulation>>(GRADE_SIMULATION_KEY, {})
  ),
  setGradeSimulations: (simulations: Record<string, GradeSimulation>) => (
    safeWrite(GRADE_SIMULATION_KEY, simulations)
  ),
  getScheduleCache: (platformUserId: number) => {
    if (!Number.isSafeInteger(platformUserId) || platformUserId <= 0) return null
    const channel = getAcademicQueryChannel()
    const value = safeRead<unknown>(scheduleCacheKey(platformUserId, channel), null)
    return validScheduleCache(value, platformUserId, channel) ? value : null
  },
  setScheduleCache: (
    platformUserId: number,
    periods: AcademicPeriod[],
    coursesByPeriod: Record<string, Course[]>,
  ) => {
    if (!Number.isSafeInteger(platformUserId) || platformUserId <= 0) return
    const channel = getAcademicQueryChannel()
    safeWrite<AcademicScheduleCache>(scheduleCacheKey(platformUserId, channel), {
      version: 2,
      platformUserId,
      channel,
      periods,
      coursesByPeriod,
    })
  },
}
