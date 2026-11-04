import Taro from '@tarojs/taro'
import { isQualificationEdition } from '../app-edition'
import { rememberCourseMaterialNavigationIntent } from '../course-materials/navigation-intent'
import type { CourseMaterialNavigation } from '../course-materials/route'
import {
  markAcademicRefreshAfterVerification,
  resolveAcademicRefreshReturnRoute,
} from './refresh-signal'

const VERIFICATION_PAGE = '/pages/academic-verification/index'
const RETURN_TARGET_KEY = 'campus.academicVerification.returnTarget.v1'
const RETURN_TARGET_TTL = 30 * 60 * 1000

const TAB_PAGES = new Set([
  '/pages/index/index',
  ...(!isQualificationEdition
    ? ['/pages/community/index', '/pages/materials/index']
    : []),
  '/pages/messages/index',
  '/pages/profile/index',
])

const SAFE_PAGES = new Set([
  ...TAB_PAGES,
  ...(!isQualificationEdition ? [
    '/pages/community/detail',
    '/pages/errands/detail',
    '/pages/marketplace/detail',
    '/pages/carpool/detail',
    '/pages/my-services/index',
    '/pages/publish/index',
    '/pages/materials/index',
    '/pages/clubs/index',
    '/pages/clubs/detail',
    '/pages/clubs/edit',
    '/pages/clubs/mine',
  ] : []),
  '/pages/academic/schedule/index',
  '/pages/academic/timetable-buddy/index',
  '/pages/academic/grades/index',
  '/pages/academic/exams/index',
  '/pages/academic/selection/index',
  '/pages/academic/course-addition-results/index',
  '/pages/services/index',
  '/pages/lottery/detail',
  '/pages/lottery/codes/index',
  '/pages/lottery/win/index',
  '/pages/feature-migrated/index',
])

type ReturnTarget = {
  url: string
  createdAt: number
}

let promptPromise: Promise<boolean> | null = null

const currentPage = () => {
  const pages = Taro.getCurrentPages()
  return pages[pages.length - 1] as unknown as {
    route?: string
    options?: Record<string, unknown>
  } | undefined
}

const currentRoute = () => {
  const route = currentPage()?.route || ''
  return route ? `/${route.replace(/^\/+/, '')}` : ''
}

const safeQuery = (options?: Record<string, unknown>) => {
  if (!options) return ''
  const sensitiveKey = /password|token|secret|credential|file|image|code/i
  const parts = Object.entries(options)
    .filter(([key, value]) => (
      (!sensitiveKey.test(key) || key === 'courseCode')
      && value !== undefined
      && value !== null
      && String(value).length <= 300
    ))
    .slice(0, 10)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  return parts.length ? `?${parts.join('&')}` : ''
}

const parseCourseMaterialReturnContext = (url: string): CourseMaterialNavigation => {
  const query = url.split('?')[1]
  if (!query) return {}
  const values: Record<string, string> = {}
  query.split('&').forEach((part) => {
    const separator = part.indexOf('=')
    if (separator < 0) return
    try {
      const key = decodeURIComponent(part.slice(0, separator).replace(/\+/g, ' '))
      const value = decodeURIComponent(part.slice(separator + 1).replace(/\+/g, ' '))
      values[key] = value
    } catch {
      // 丢弃无法解析的旧路由参数。
    }
  })
  const positiveNumber = (value?: string) => {
    const parsed = Number(value)
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined
  }
  const source = ['schedule', 'grades', 'selection', 'exams', 'discussion'].includes(values.source)
    ? values.source as CourseMaterialNavigation['source']
    : undefined
  const sourceType = ['file', 'cloud_share'].includes(values.sourceType)
    ? values.sourceType as CourseMaterialNavigation['sourceType']
    : undefined
  const materialType = ['slides', 'notes', 'exam', 'homework', 'review', 'other']
    .includes(values.materialType)
    ? values.materialType as CourseMaterialNavigation['materialType']
    : undefined
  return {
    courseName: values.courseName,
    courseId: positiveNumber(values.courseId),
    courseCode: values.courseCode,
    periodId: values.periodId,
    periodLabel: values.periodLabel,
    source,
    sourceType,
    materialType,
    keyword: values.keyword,
    action: values.action === 'upload' ? 'upload' : undefined,
    view: values.view === 'mine' ? 'mine' : undefined,
    materialId: positiveNumber(values.material_id),
  }
}

const captureReturnTarget = () => {
  const page = currentPage()
  const route = currentRoute()
  if (!page || !SAFE_PAGES.has(route)) return
  const target: ReturnTarget = {
    url: `${route}${safeQuery(page.options)}`,
    createdAt: Date.now(),
  }
  Taro.setStorageSync(RETURN_TARGET_KEY, target)
}

const readReturnTarget = (): ReturnTarget | null => {
  const value = Taro.getStorageSync<ReturnTarget>(RETURN_TARGET_KEY)
  if (
    !value
    || typeof value.url !== 'string'
    || typeof value.createdAt !== 'number'
    || Date.now() - value.createdAt > RETURN_TARGET_TTL
  ) {
    Taro.removeStorageSync(RETURN_TARGET_KEY)
    return null
  }
  const path = value.url.split('?')[0]
  if (!SAFE_PAGES.has(path)) {
    Taro.removeStorageSync(RETURN_TARGET_KEY)
    return null
  }
  return value
}

export const openAcademicVerification = (
  options: { prompt?: boolean } = {},
): Promise<boolean> => {
  if (currentRoute() === VERIFICATION_PAGE) return Promise.resolve(true)
  if (promptPromise) return promptPromise

  promptPromise = (async () => {
    if (options.prompt !== false) {
      const result = await Taro.showModal({
        title: '需要校园身份认证',
        content: '认证后即可发布、接单、交易和参与校园服务。',
        confirmText: '去认证',
        cancelText: '暂不认证',
        confirmColor: '#5a9d88',
      })
      if (!result.confirm) return false
    }

    captureReturnTarget()
    try {
      await Taro.navigateTo({ url: VERIFICATION_PAGE })
    } catch {
      await Taro.redirectTo({ url: `${VERIFICATION_PAGE}?replaced=1` })
    }
    return true
  })().finally(() => {
    promptPromise = null
  })

  return promptPromise
}

export const handleAcademicVerificationRequired = () => (
  openAcademicVerification({ prompt: true })
)

export const finishAcademicVerification = async (
  replacedCurrentPage = false,
  refreshAcademicPage = false,
) => {
  const target = readReturnTarget()
  Taro.removeStorageSync(RETURN_TARGET_KEY)
  const pages = Taro.getCurrentPages()
  if (!replacedCurrentPage && pages.length > 1) {
    const previousRoute = pages[pages.length - 2]?.route
    if (refreshAcademicPage) {
      markAcademicRefreshAfterVerification(
        Taro,
        resolveAcademicRefreshReturnRoute(target?.url, previousRoute),
      )
    }
    await Taro.navigateBack()
    return
  }
  if (!target) {
    await Taro.reLaunch({ url: '/pages/index/index' })
    return
  }
  const path = target.url.split('?')[0]
  if (refreshAcademicPage) {
    markAcademicRefreshAfterVerification(
      Taro,
      resolveAcademicRefreshReturnRoute(target.url),
    )
  }
  if (TAB_PAGES.has(path)) {
    if (path === '/pages/materials/index') {
      const context = parseCourseMaterialReturnContext(target.url)
      if (Object.values(context).some((value) => value !== undefined && value !== '')) {
        rememberCourseMaterialNavigationIntent(context)
      }
    }
    await Taro.switchTab({ url: path })
    return
  }
  await Taro.redirectTo({ url: target.url })
}
