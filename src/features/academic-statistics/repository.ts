import Taro from '@tarojs/taro'
import {
  getAcademicCoursePassRate,
  getAcademicCoursePassRateTrend,
  getAcademicInstructorPassRateTrend,
  listAcademicInstructorPassRates,
} from '../../api/academic-statistics'
import type {
  AcademicCoursePassRatePage,
  AcademicInstructorPassRatePage,
  AcademicPassRateTrend,
} from '../../api/types'

const CACHE_VERSION = 1
const CACHE_TTL = 24 * 60 * 60 * 1000
const CACHE_KEY_PREFIX = 'campus.academicStatistics.course.v1.'

export type CoursePassRate = AcademicCoursePassRatePage['items'][number]
export type InstructorPassRate = AcademicInstructorPassRatePage['items'][number]

export type CourseStatistics = {
  overview: CoursePassRate
  instructors: InstructorPassRate[]
  trend: AcademicPassRateTrend
  publishedAt: string
}

export type CachedResult<T> = {
  data: T
  fromCache: boolean
}

type CourseStatisticsCache = {
  version: typeof CACHE_VERSION
  expiresAt: number
  data: CourseStatistics
}

const cacheKey = (courseCode: string) => (
  `${CACHE_KEY_PREFIX}${encodeURIComponent(courseCode.trim())}`
)

const readCache = (courseCode: string) => {
  const cached = Taro.getStorageSync<CourseStatisticsCache>(cacheKey(courseCode))
  if (
    !cached
    || cached.version !== CACHE_VERSION
    || cached.expiresAt <= Date.now()
    || !cached.data
  ) return null
  return cached.data
}

const writeCache = (courseCode: string, data: CourseStatistics) => {
  Taro.setStorageSync(cacheKey(courseCode), {
    version: CACHE_VERSION,
    expiresAt: Date.now() + CACHE_TTL,
    data,
  } satisfies CourseStatisticsCache)
}

const requireCourseCode = (courseCode: string) => {
  const value = courseCode.trim()
  if (!value) throw new Error('缺少课程编号')
  return value
}

export const getCourseStatistics = async (
  courseCode: string,
): Promise<CachedResult<CourseStatistics>> => {
  const normalized = requireCourseCode(courseCode)
  try {
    const [coursePage, instructorPage, trend] = await Promise.all([
      getAcademicCoursePassRate(normalized),
      listAcademicInstructorPassRates(normalized),
      getAcademicCoursePassRateTrend(normalized),
    ])
    const overview = coursePage.items[0]
    if (!overview) throw new Error('暂未积累到足够的历史样本')
    const data: CourseStatistics = {
      overview,
      instructors: instructorPage.items,
      trend,
      publishedAt: coursePage.metadata.published_at,
    }
    writeCache(normalized, data)
    return { data, fromCache: false }
  } catch (error) {
    const cached = readCache(normalized)
    if (cached) return { data: cached, fromCache: true }
    throw error
  }
}

export const getCoursePassRatePreview = async (
  courseCode: string,
): Promise<CachedResult<CoursePassRate | null>> => {
  const normalized = requireCourseCode(courseCode)
  const cached = readCache(normalized)
  try {
    const page = await getAcademicCoursePassRate(normalized)
    return { data: page.items[0] || null, fromCache: false }
  } catch (error) {
    if (cached) return { data: cached.overview, fromCache: true }
    throw error
  }
}

export const getInstructorStatisticsTrend = (
  courseCode: string,
  teacherKey: string,
) => getAcademicInstructorPassRateTrend(
  requireCourseCode(courseCode),
  teacherKey.trim(),
)
