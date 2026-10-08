import Taro from '@tarojs/taro'
import {
  AcademicPeriod,
  AcademicPreferences,
  AcademicRecordsCache,
  CourseSelectionRecord,
  Course,
  ExamRecord,
  GradeRecord,
  GradeSimulation,
} from './types'
import { createAdditionCache } from './course-addition-results/addition-cache'
import { sanitizeCoursesByPeriod } from './schedule-courses'

const CUSTOM_COURSES_KEY = 'academic.customCourses.v1'
const CUSTOM_COURSES_OWNER_KEY = 'academic.customCourses.legacyOwner.v1'
const PREFERENCES_KEY = 'academic.preferences.v1'
const GRADE_SIMULATION_KEY = 'academic.gradeSimulation.v1'
const SCHEDULE_REFRESH_GUIDE_KEY = 'academic.scheduleRefreshGuide.v2'
const SCHEDULE_SELECTION_GUIDE_KEY = 'academic.scheduleSelectionGuide.v1'
const SCHEDULE_BUDDY_GUIDE_KEY = 'academic.scheduleBuddyGuide.v1'
const COURSE_CATALOG_FLOAT_GUIDE_KEY = 'academic.courseCatalogFloatGuide.v1'
const COURSE_CATALOG_DISCLAIMER_SEEN_KEY = 'academic.courseCatalogDisclaimerSeen.v1'
const SCHEDULE_CACHE_KEY_PREFIX = 'academic.scheduleCache.v1.'
const RECORDS_CACHE_KEY_PREFIX = 'academic.recordsCache.v1.'
const SELECTION_DRAFT_KEY = 'academic.selectionDraft.v1'
const SELECTION_SCHEDULE_CACHE_KEY_PREFIX = 'academic.courseSelectionScheduleCache.v1.'
const PERSONAL_COURSES_V1_KEY_PREFIX = 'academic.personalCourses.v1.'
const PERSONAL_COURSES_V2_KEY_PREFIX = 'academic.personalCourses.v2.'

/** CustomCoursesShareReadErrorKind 标识共享课表自定义课程读取失败原因。 */
export type CustomCoursesShareReadErrorKind =
  | 'invalid_scope'
  | 'storage_read_failed'
  | 'corrupt_scoped'
  | 'corrupt_legacy'
  | 'corrupt_legacy_owner'

/** CustomCoursesShareReadError 表示共享课表读取自定义课程时遇到可恢复错误。 */
export class CustomCoursesShareReadError extends Error {
  readonly kind: CustomCoursesShareReadErrorKind

  constructor(kind: CustomCoursesShareReadErrorKind) {
    super({
      invalid_scope: '无法确认当前账号，未同步本机自定义课程。',
      storage_read_failed: '本机自定义课程暂时读取失败，原数据未更改；请重新读取后重试。',
      corrupt_scoped: '自定义课程记录不完整，原数据已保留并暂停同步；请重新读取本人课表，若仍异常请联系校园支持。',
      corrupt_legacy: '旧版自定义课程记录不完整，原数据已保留并暂停同步；请核对原账号后联系校园支持。',
      corrupt_legacy_owner: '旧版课程归属记录异常，原数据已保留；请切回曾保存课程的账号核对后重试。',
    }[kind])
    Object.setPrototypeOf(this, CustomCoursesShareReadError.prototype)
    this.name = 'CustomCoursesShareReadError'
    this.kind = kind
  }
}

/** CustomCoursesShareReadResult 区分可信课程、空缺记录与未确认归属的旧记录。 */
export type CustomCoursesShareReadResult =
  | {
    status: 'ready'
    courses: Course[]
    source: 'scoped' | 'legacy'
    ownership: 'scoped' | 'owner_key' | 'credential'
  }
  | {
    status: 'missing_scoped'
    courses: []
    source: 'none'
    ownership: 'none'
  }
  | {
    status: 'legacy_unowned'
    courses: []
    source: 'legacy'
    ownership: 'unconfirmed'
    reason: 'owner_mismatch'
    legacyOwnerUserId: number
    ownerSource: 'owner_key' | 'credential'
  }
  | {
    status: 'legacy_unowned'
    courses: []
    source: 'legacy'
    ownership: 'unconfirmed'
    reason: 'owner_unknown'
  }

/** CustomCoursesScheduleLoadResult 表示课表页已安全加载，或必须保护本机数据并暂停修改。 */
export type CustomCoursesScheduleLoadResult =
  | { status: 'ready'; courses: Course[] }
  | { status: 'blocked'; courses: Course[]; message: string }

type StoredValue = { present: false } | { present: true; value: unknown }

export interface AcademicScheduleCache {
  version: 1
  platformUserId: number
  periods: AcademicPeriod[]
  coursesByPeriod: Record<string, Course[]>
  coursesUpdatedAtByPeriod: Record<string, number>
  /** 每个学期最近一次课表接口返回的全局提示。 */
  scheduleNotesByPeriod?: Record<string, string>
  /** 旧版本的全局课程更新时间，仅用于读取迁移。 */
  updatedAt?: number
}

const safeRead = <T>(key: string, fallback: T): T => {
  try {
    return Taro.getStorageSync<T>(key) || fallback
  } catch (error) {
    return fallback
  }
}

const safeWriteWithResult = <T>(key: string, value: T): boolean => {
  try {
    Taro.setStorageSync(key, value)
    return true
  } catch {
    Taro.showToast({ title: '本地保存失败，请稍后重试', icon: 'none' })
    return false
  }
}

const safeWrite = <T>(key: string, value: T) => {
  safeWriteWithResult(key, value)
}

const getLocalDayKey = (date = new Date()) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-')

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
    && (course.classNum === undefined || typeof course.classNum === 'string')
    && (course.note === undefined || typeof course.note === 'string')
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

const scopedCustomCoursesKey = (platformUserId: number) => (
  `academic.customCourses.v2.${platformUserId}`
)

const readStrictStorageValue = (key: string): StoredValue => {
  try {
    const keys = Taro.getStorageInfoSync().keys
    if (!Array.isArray(keys)) throw new Error('storage keys unavailable')
    if (!keys.includes(key)) return { present: false }
    return { present: true, value: Taro.getStorageSync<unknown>(key) }
  } catch {
    throw new CustomCoursesShareReadError('storage_read_failed')
  }
}

const isNonEmptyString = (value: unknown): value is string => (
  typeof value === 'string' && !!value.trim()
)

const validShareableCustomCourse = (value: unknown): value is Course => {
  if (!value || typeof value !== 'object') return false
  const course = value as Course
  if (
    !isNonEmptyString(course.id)
    || !isNonEmptyString(course.periodId)
    || course.source !== 'custom'
  ) return false

  return isNonEmptyString(course.name)
    && typeof course.teacher === 'string'
    && typeof course.location === 'string'
    && (course.classNum === undefined || typeof course.classNum === 'string')
    && (course.note === undefined || typeof course.note === 'string')
    && (course.campus === undefined || typeof course.campus === 'string')
    && Number.isInteger(course.weekday)
    && course.weekday >= 1
    && course.weekday <= 7
    && Number.isInteger(course.startSection)
    && Number.isInteger(course.endSection)
    && course.startSection >= 1
    && course.endSection <= 12
    && course.startSection <= course.endSection
    && Array.isArray(course.weeks)
    && course.weeks.length > 0
    && course.weeks.every((week) => Number.isInteger(week) && week >= 1 && week <= 30)
    && typeof course.color === 'string'
}

const readCustomCoursesForSharing = (
  platformUserId: number,
): CustomCoursesShareReadResult => {
  if (!Number.isSafeInteger(platformUserId) || platformUserId <= 0) {
    throw new CustomCoursesShareReadError('invalid_scope')
  }

  const readCourses = (value: unknown, source: 'scoped' | 'legacy', ownership: 'scoped' | 'owner_key' | 'credential'):
    CustomCoursesShareReadResult => {
    const errorKind = source === 'scoped' ? 'corrupt_scoped' : 'corrupt_legacy'
    if (!Array.isArray(value)) throw new CustomCoursesShareReadError(errorKind)

    const customCourses: Course[] = []
    const seenCourseIdsByPeriod = new Set<string>()
    for (const item of value) {
      if (!validShareableCustomCourse(item)) {
        throw new CustomCoursesShareReadError(errorKind)
      }
      const idByPeriod = `${item.periodId}\u0000${item.id}`
      if (seenCourseIdsByPeriod.has(idByPeriod)) throw new CustomCoursesShareReadError(errorKind)
      seenCourseIdsByPeriod.add(idByPeriod)
      customCourses.push(item)
    }

    return { status: 'ready', courses: customCourses, source, ownership }
  }

  const scoped = readStrictStorageValue(scopedCustomCoursesKey(platformUserId))
  if (scoped.present) return readCourses(scoped.value, 'scoped', 'scoped')

  const legacy = readStrictStorageValue(CUSTOM_COURSES_KEY)
  if (!legacy.present) {
    return { status: 'missing_scoped', courses: [], source: 'none', ownership: 'none' }
  }

  const owner = readStrictStorageValue(CUSTOM_COURSES_OWNER_KEY)
  if (owner.present && owner.value !== 0) {
    if (!Number.isSafeInteger(owner.value) || (owner.value as number) <= 0) {
      throw new CustomCoursesShareReadError('corrupt_legacy_owner')
    }
    if (owner.value !== platformUserId) {
      return {
        status: 'legacy_unowned',
        courses: [],
        source: 'legacy',
        ownership: 'unconfirmed',
        reason: 'owner_mismatch',
        legacyOwnerUserId: owner.value as number,
        ownerSource: 'owner_key',
      }
    }
    return readCourses(legacy.value, 'legacy', 'owner_key')
  }

  const credential = readStrictStorageValue('campus.academicCredential.v1')
  if (credential.present && credential.value && typeof credential.value === 'object') {
    const credentialUserId = (credential.value as { platformUserId?: unknown }).platformUserId
    if (Number.isSafeInteger(credentialUserId) && (credentialUserId as number) > 0) {
      if (credentialUserId === platformUserId) return readCourses(legacy.value, 'legacy', 'credential')
      return {
        status: 'legacy_unowned',
        courses: [],
        source: 'legacy',
        ownership: 'unconfirmed',
        reason: 'owner_mismatch',
        legacyOwnerUserId: credentialUserId as number,
        ownerSource: 'credential',
      }
    }
  }

  return {
    status: 'legacy_unowned', courses: [], source: 'legacy', ownership: 'unconfirmed', reason: 'owner_unknown',
  }
}

const loadCustomCoursesForSchedule = (platformUserId: number): CustomCoursesScheduleLoadResult => {
  try {
    const result = readCustomCoursesForSharing(platformUserId)
    if (result.status === 'missing_scoped') {
      if (!safeWriteWithResult(scopedCustomCoursesKey(platformUserId), [])) {
        return {
          status: 'blocked',
          courses: [],
          message: '本机暂时无法保存自定义课程，请点击重新读取后重试；未保存的数据不会同步。',
        }
      }
      return { status: 'ready', courses: [] }
    }

    if (result.status === 'legacy_unowned') {
      if (result.reason === 'owner_unknown') {
        return {
          status: 'blocked',
          courses: [],
          message: '旧版自定义课程归属无法确认，已保留本机数据；请切回原账号核对课程归属后再重试。',
        }
      }
      if (
        result.ownerSource === 'credential'
        && !safeWriteWithResult(CUSTOM_COURSES_OWNER_KEY, result.legacyOwnerUserId)
      ) {
        return {
          status: 'blocked',
          courses: [],
          message: '无法保存旧版课程归属信息，请点击重新读取后重试；原课程仍保留在本机。',
        }
      }
      if (!safeWriteWithResult(scopedCustomCoursesKey(platformUserId), [])) {
        return {
          status: 'blocked',
          courses: [],
          message: '本机暂时无法保存当前账号的空自定义课表，请点击重新读取后重试；旧版课程未被改动。',
        }
      }
      return { status: 'ready', courses: [] }
    }

    if (result.source === 'legacy') {
      if (
        result.ownership === 'credential'
        && !safeWriteWithResult(CUSTOM_COURSES_OWNER_KEY, platformUserId)
      ) {
        return {
          status: 'blocked',
          courses: result.courses,
          message: '旧版课程读取成功，但无法保存课程归属；课程已保留显示，请重新读取后再修改。',
        }
      }
      if (!safeWriteWithResult(scopedCustomCoursesKey(platformUserId), result.courses)) {
        return {
          status: 'blocked',
          courses: result.courses,
          message: '旧版课程读取成功，但本机迁移保存失败；课程已保留显示，请重新读取后再修改。',
        }
      }
    }

    return { status: 'ready', courses: result.courses }
  } catch (error) {
    const message = error instanceof CustomCoursesShareReadError
      ? error.kind === 'corrupt_scoped' || error.kind === 'corrupt_legacy'
        ? '自定义课程记录不完整，原数据已保留并暂停修改；请重新打开本人课表尝试恢复，若仍异常请联系校园支持。'
        : error.kind === 'corrupt_legacy_owner'
          ? '旧版课程归属记录异常，原数据已保留；请切回曾保存课程的账号核对后重试。'
          : '本机自定义课程暂时读取失败，原数据未更改；请点击重新读取后重试。'
      : '本机自定义课程暂时读取失败，原数据未更改；请点击重新读取后重试。'
    return {
      status: 'blocked',
      courses: [],
      message,
    }
  }
}

const personalCoursesKey = (
  version: 1 | 2,
  userId: number,
  level: string,
  periodId: string,
) => `${version === 2 ? PERSONAL_COURSES_V2_KEY_PREFIX : PERSONAL_COURSES_V1_KEY_PREFIX}${userId}.${level}.${periodId}`

const validPersonalCourses = (value: unknown, periodId: string): Course[] => (
  Array.isArray(value) ? value.filter((course): course is Course => (
    Boolean(course) && course.source === 'audit'
    && validCourse({ ...course, source: 'official' }) && course.periodId === periodId
  )) : []
)

/**
 * v1 把班级名称或开课实例 ID 写入了 classNum。保留旧课程展示，
 * 但禁止它们在离线状态下参与按选课号聚合的功能。
 */
export const migrateLegacyPersonalCourses = (value: unknown, periodId: string): Course[] => (
  validPersonalCourses(value, periodId).map(({ classNum: _classNum, ...course }) => course)
)

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

const selectionScheduleCacheKey = (platformUserId: number) => (
  `${SELECTION_SCHEDULE_CACHE_KEY_PREFIX}${platformUserId}`
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

const validStringMap = (value: unknown): value is Record<string, string> => (
  !!value
  && typeof value === 'object'
  && Object.values(value).every(validString)
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
    && (
      validTimestampMap(cache.coursesUpdatedAtByPeriod)
      || (
        cache.coursesUpdatedAtByPeriod === undefined
        && (cache.updatedAt === undefined || validFiniteNumber(cache.updatedAt))
      )
    )
    && (
      cache.scheduleNotesByPeriod === undefined
      || validStringMap(cache.scheduleNotesByPeriod)
    )
  )
}

const scheduleUpdatedAtByPeriod = (
  cache: AcademicScheduleCache,
  coursesByPeriod: Record<string, Course[]>,
) => {
  if (validTimestampMap(cache.coursesUpdatedAtByPeriod)) {
    return Object.fromEntries(
      Object.entries(cache.coursesUpdatedAtByPeriod)
        .filter(([periodId, timestamp]) => (
          Object.prototype.hasOwnProperty.call(coursesByPeriod, periodId)
          && validFiniteNumber(timestamp)
        )),
    )
  }
  if (!validFiniteNumber(cache.updatedAt)) return {}
  return Object.fromEntries(
    Object.keys(coursesByPeriod).map((periodId) => [periodId, cache.updatedAt as number]),
  )
}

// 加课结果独立缓存，用身份作用域隔离；生产使用 Taro storage，测试注入内存后端。
const additionCache = createAdditionCache({
  get: (key) => {
    try {
      return Taro.getStorageSync(key)
    } catch {
      return null
    }
  },
  set: (key, value) => {
    try {
      Taro.setStorageSync(key, value)
    } catch {
      // 写入失败不应使已成功的网络结果变成失败。
    }
  },
})

export const academicStorage = {
  hasSeenScheduleBuddyGuideToday: () => (
    safeRead<string>(SCHEDULE_BUDDY_GUIDE_KEY, '') === getLocalDayKey()
  ),
  markScheduleBuddyGuideSeenToday: () => {
    try {
      Taro.setStorageSync(SCHEDULE_BUDDY_GUIDE_KEY, getLocalDayKey())
    } catch {
      // 引导状态不是关键数据，保存失败时无需打扰用户。
    }
  },
  getSelectionDraftCourses: (): Course[] => safeRead<Course[]>(SELECTION_DRAFT_KEY, []).filter((course) => course.source === 'simulation'),
  setSelectionDraftCourses: (courses: Course[]) => safeWrite(SELECTION_DRAFT_KEY, courses),
  getCourseSelectionScheduleCourses: (platformUserId: number): Course[] => (
    safeRead<Course[]>(selectionScheduleCacheKey(platformUserId), [])
      .filter(validCourse)
  ),
  setCourseSelectionScheduleCourses: (platformUserId: number, courses: Course[]) => (
    safeWrite(selectionScheduleCacheKey(platformUserId), courses)
  ),
  hasSeenScheduleRefreshGuideToday: () => (
    safeRead<string>(SCHEDULE_REFRESH_GUIDE_KEY, '') === getLocalDayKey()
  ),
  markScheduleRefreshGuideSeenToday: () => {
    try {
      Taro.setStorageSync(SCHEDULE_REFRESH_GUIDE_KEY, getLocalDayKey())
    } catch (error) {
      // 引导状态不是关键数据，保存失败时无需打扰用户。
    }
  },
  hasSeenScheduleSelectionGuideToday: () => (
    safeRead<string>(SCHEDULE_SELECTION_GUIDE_KEY, '') === getLocalDayKey()
  ),
  markScheduleSelectionGuideSeenToday: () => {
    try {
      Taro.setStorageSync(SCHEDULE_SELECTION_GUIDE_KEY, getLocalDayKey())
    } catch (error) {
      // 引导状态不是关键数据，保存失败时无需打扰用户。
    }
  },
  hasSeenCourseCatalogFloatGuideToday: () => (
    safeRead<string>(COURSE_CATALOG_FLOAT_GUIDE_KEY, '') === getLocalDayKey()
  ),
  markCourseCatalogFloatGuideSeenToday: () => {
    try {
      Taro.setStorageSync(COURSE_CATALOG_FLOAT_GUIDE_KEY, getLocalDayKey())
    } catch (error) {
      // 引导状态不是关键数据，保存失败时无需打扰用户。
    }
  },
  hasSeenCourseCatalogDisclaimer: () => (
    safeRead<boolean>(COURSE_CATALOG_DISCLAIMER_SEEN_KEY, false)
  ),
  markCourseCatalogDisclaimerSeen: () => {
    try {
      Taro.setStorageSync(COURSE_CATALOG_DISCLAIMER_SEEN_KEY, true)
    } catch (error) {
      // 说明状态不是关键数据，保存失败时无需打扰用户。
    }
  },
  getPersonalCourses: (userId: number, level: string, periodId: string): Course[] => {
    const v2Value = safeRead<unknown>(personalCoursesKey(2, userId, level, periodId), null)
    if (v2Value !== null) return validPersonalCourses(v2Value, periodId)
    const v1Value = safeRead<unknown>(personalCoursesKey(1, userId, level, periodId), [])
    return migrateLegacyPersonalCourses(v1Value, periodId)
  },
  setPersonalCourses: (userId: number, level: string, periodId: string, courses: Course[]) => {
    safeWrite(personalCoursesKey(2, userId, level, periodId), courses)
  },
  getCustomCourses: (platformUserId?: number): Course[] => {
    if (platformUserId === undefined) return safeRead<Course[]>(CUSTOM_COURSES_KEY, [])
    try {
      const result = readCustomCoursesForSharing(platformUserId)
      return result.status === 'ready' ? result.courses : []
    } catch (error) {
      if (
        error instanceof CustomCoursesShareReadError
        && error.kind === 'corrupt_scoped'
      ) {
        const scoped = safeRead<unknown>(scopedCustomCoursesKey(platformUserId), null)
        return Array.isArray(scoped) ? scoped.filter((course) => (
          course && course.source === 'custom' && validCourse({ ...course, source: 'official' })
        )) : []
      }
      return []
    }
  },
  /** loadCustomCoursesForSchedule 安全迁移可信旧记录，并为确实缺失的账号创建显式空列表。 */
  loadCustomCoursesForSchedule,
  /** readCustomCoursesForSharing 按账号只读并原子校验全部学期自定义课程；异常时抛错且不迁移或写回。 */
  readCustomCoursesForSharing,
  setCustomCourses: (courses: Course[], platformUserId?: number) => safeWrite(
    platformUserId === undefined ? CUSTOM_COURSES_KEY : scopedCustomCoursesKey(platformUserId), courses,
  ),
  /** trySetCustomCourses 持久化自定义课程并返回实际写入结果，供修改 UI 决定是否更新内存。 */
  trySetCustomCourses: (courses: Course[], platformUserId?: number): boolean => safeWriteWithResult(
    platformUserId === undefined ? CUSTOM_COURSES_KEY : scopedCustomCoursesKey(platformUserId), courses,
  ),
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
    if (!validScheduleCache(value, platformUserId)) return null
    const coursesByPeriod = sanitizeCoursesByPeriod(value.coursesByPeriod)
    return {
      ...value,
      coursesByPeriod,
      coursesUpdatedAtByPeriod: scheduleUpdatedAtByPeriod(value, coursesByPeriod),
      scheduleNotesByPeriod: validStringMap(value.scheduleNotesByPeriod)
        ? value.scheduleNotesByPeriod
        : {},
    }
  },
  setScheduleCache: (
    platformUserId: number,
    periods: AcademicPeriod[],
    coursesByPeriod: Record<string, Course[]>,
    coursesUpdatedAtByPeriod: Record<string, number>,
    scheduleNotesByPeriod: Record<string, string> = {},
  ) => {
    if (!Number.isSafeInteger(platformUserId) || platformUserId <= 0) return
    const sanitizedCourses = sanitizeCoursesByPeriod(coursesByPeriod)
    const periodIds = new Set(periods.map((period) => period.id))
    safeWrite<AcademicScheduleCache>(scheduleCacheKey(platformUserId), {
      version: 1,
      platformUserId,
      periods,
      coursesByPeriod: sanitizedCourses,
      coursesUpdatedAtByPeriod: Object.fromEntries(
        Object.entries(coursesUpdatedAtByPeriod)
          .filter(([periodId, timestamp]) => (
            Object.prototype.hasOwnProperty.call(sanitizedCourses, periodId)
          && validFiniteNumber(timestamp)
        )),
      ),
      scheduleNotesByPeriod: Object.fromEntries(
        Object.entries(scheduleNotesByPeriod)
          .filter(([periodId, note]) => periodIds.has(periodId) && validString(note)),
      ),
    })
  },
  getRecordsCache: (platformUserId: number) => {
    if (!Number.isSafeInteger(platformUserId) || platformUserId <= 0) return null
    const value = safeRead<unknown>(recordsCacheKey(platformUserId), null)
    if (!validRecordsCache(value, platformUserId)) return null
    return { ...value }
  },
  getAdditionRecords: additionCache.getAdditionRecords,
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
  setAdditionRecords: additionCache.setAdditionRecords,
}
