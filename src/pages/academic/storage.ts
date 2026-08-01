import Taro from '@tarojs/taro'
import {
  AcademicPeriod,
  AcademicPreferences,
  CourseSelectionRecord,
  Course,
  ExamRecord,
  GradeRecord,
  GradeSimulation,
} from './types'

const CUSTOM_COURSES_KEY = 'academic.customCourses.v1'
const PREFERENCES_KEY = 'academic.preferences.v1'
const GRADE_SIMULATION_KEY = 'academic.gradeSimulation.v1'
const SCHEDULE_CACHE_KEY_PREFIX = 'academic.scheduleCache.v1.'
const RECORDS_CACHE_KEY_PREFIX = 'academic.recordsCache.v1.'

export interface AcademicScheduleCache {
  version: 1
  platformUserId: number
  periods: AcademicPeriod[]
  coursesByPeriod: Record<string, Course[]>
  updatedAt?: number
}

export interface AcademicRecordsCache {
  version: 1
  platformUserId: number
  grades: GradeRecord[]
  gradesUpdatedAt: number
  examsByPeriod: Record<string, ExamRecord[]>
  examsUpdatedAtByPeriod: Record<string, number>
  selectionsByPeriod: Record<string, CourseSelectionRecord[]>
  selectionsUpdatedAtByPeriod: Record<string, number>
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

const validString = (value: unknown) => typeof value === 'string'
const validOptionalString = (value: unknown) => value === undefined || validString(value)
const validFiniteNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value)

const validGrade = (value: unknown): value is GradeRecord => {
  if (!value || typeof value !== 'object') return false
  const grade = value as GradeRecord
  return validString(grade.id)
    && validString(grade.periodId)
    && validString(grade.courseName)
    && validOptionalString(grade.courseCode)
    && validString(grade.courseType)
    && validFiniteNumber(grade.credit)
    && (grade.score === undefined || validFiniteNumber(grade.score))
    && validOptionalString(grade.gradeType)
    && validOptionalString(grade.gradeLevel)
}

const validExam = (value: unknown): value is ExamRecord => {
  if (!value || typeof value !== 'object') return false
  const exam = value as ExamRecord
  return validString(exam.id)
    && validString(exam.periodId)
    && validString(exam.courseName)
    && validString(exam.startAt)
    && validString(exam.endAt)
    && validString(exam.campus)
    && validString(exam.location)
    && validString(exam.seat)
    && validString(exam.phase)
    && validString(exam.method)
    && validString(exam.materials)
    && validString(exam.notice)
}

const validSelection = (value: unknown): value is CourseSelectionRecord => {
  if (!value || typeof value !== 'object') return false
  const selection = value as CourseSelectionRecord
  return validString(selection.id)
    && validString(selection.periodId)
    && validString(selection.courseName)
    && validString(selection.courseCode)
    && validString(selection.courseType)
    && validFiniteNumber(selection.credit)
    && validString(selection.teacher)
    && validString(selection.campus)
    && validString(selection.location)
    && validString(selection.schedule)
    && validFiniteNumber(selection.capacity)
    && validFiniteNumber(selection.enrolled)
    && ['selected', 'pending', 'failed'].includes(selection.status)
    && validString(selection.selectedAt)
    && validOptionalString(selection.resultText)
    && validOptionalString(selection.note)
}

const scheduleCacheKey = (platformUserId: number) => (
  `${SCHEDULE_CACHE_KEY_PREFIX}${platformUserId}`
)

const recordsCacheKey = (platformUserId: number) => (
  `${RECORDS_CACHE_KEY_PREFIX}${platformUserId}`
)

const validRecordMap = <T>(
  value: unknown,
  validator: (record: unknown) => record is T,
): value is Record<string, T[]> => (
  !!value
  && typeof value === 'object'
  && Object.values(value).every((records) => (
    Array.isArray(records) && records.every(validator)
  ))
)

const validTimestampMap = (value: unknown): value is Record<string, number> => (
  !!value
  && typeof value === 'object'
  && Object.values(value).every(validFiniteNumber)
)

const validRecordsCache = (
  value: unknown,
  platformUserId: number,
): value is AcademicRecordsCache => {
  if (!value || typeof value !== 'object') return false
  const cache = value as AcademicRecordsCache
  return cache.version === 1
    && cache.platformUserId === platformUserId
    && Array.isArray(cache.grades)
    && cache.grades.every(validGrade)
    && validFiniteNumber(cache.gradesUpdatedAt)
    && validRecordMap(cache.examsByPeriod, validExam)
    && validTimestampMap(cache.examsUpdatedAtByPeriod)
    && validRecordMap(cache.selectionsByPeriod, validSelection)
    && validTimestampMap(cache.selectionsUpdatedAtByPeriod)
}

const emptyRecordsCache = (platformUserId: number): AcademicRecordsCache => ({
  version: 1,
  platformUserId,
  grades: [],
  gradesUpdatedAt: 0,
  examsByPeriod: {},
  examsUpdatedAtByPeriod: {},
  selectionsByPeriod: {},
  selectionsUpdatedAtByPeriod: {},
})

const validScheduleCache = (
  value: unknown,
  platformUserId: number,
): value is AcademicScheduleCache => {
  if (!value || typeof value !== 'object') return false
  const cache = value as AcademicScheduleCache
  return (
    cache.version === 1
    && cache.platformUserId === platformUserId
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
    const value = safeRead<unknown>(scheduleCacheKey(platformUserId), null)
    return validScheduleCache(value, platformUserId) ? value : null
  },
  setScheduleCache: (
    platformUserId: number,
    periods: AcademicPeriod[],
    coursesByPeriod: Record<string, Course[]>,
  ) => {
    if (!Number.isSafeInteger(platformUserId) || platformUserId <= 0) return
    safeWrite<AcademicScheduleCache>(scheduleCacheKey(platformUserId), {
      version: 1,
      platformUserId,
      periods,
      coursesByPeriod,
      updatedAt: Date.now(),
    })
  },
  getRecordsCache: (platformUserId: number) => {
    if (!Number.isSafeInteger(platformUserId) || platformUserId <= 0) return null
    const value = safeRead<unknown>(recordsCacheKey(platformUserId), null)
    return validRecordsCache(value, platformUserId) ? value : null
  },
  setGradeRecords: (platformUserId: number, grades: GradeRecord[]) => {
    if (!Number.isSafeInteger(platformUserId) || platformUserId <= 0) return
    const current = academicStorage.getRecordsCache(platformUserId)
      || emptyRecordsCache(platformUserId)
    safeWrite<AcademicRecordsCache>(recordsCacheKey(platformUserId), {
      ...current,
      grades,
      gradesUpdatedAt: Date.now(),
    })
  },
  setExamRecords: (platformUserId: number, periodId: string, exams: ExamRecord[]) => {
    if (!Number.isSafeInteger(platformUserId) || platformUserId <= 0 || !periodId) return
    const current = academicStorage.getRecordsCache(platformUserId)
      || emptyRecordsCache(platformUserId)
    safeWrite<AcademicRecordsCache>(recordsCacheKey(platformUserId), {
      ...current,
      examsByPeriod: { ...current.examsByPeriod, [periodId]: exams },
      examsUpdatedAtByPeriod: {
        ...current.examsUpdatedAtByPeriod,
        [periodId]: Date.now(),
      },
    })
  },
  setSelectionRecords: (
    platformUserId: number,
    periodId: string,
    records: CourseSelectionRecord[],
  ) => {
    if (!Number.isSafeInteger(platformUserId) || platformUserId <= 0 || !periodId) return
    const current = academicStorage.getRecordsCache(platformUserId)
      || emptyRecordsCache(platformUserId)
    safeWrite<AcademicRecordsCache>(recordsCacheKey(platformUserId), {
      ...current,
      selectionsByPeriod: { ...current.selectionsByPeriod, [periodId]: records },
      selectionsUpdatedAtByPeriod: {
        ...current.selectionsUpdatedAtByPeriod,
        [periodId]: Date.now(),
      },
    })
  },
}
