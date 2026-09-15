export const ACADEMIC_REFRESH_ROUTES = [
  '/pages/academic/grades/index',
  '/pages/academic/schedule/index',
  '/pages/academic/exams/index',
  '/pages/academic/selection/index',
  '/pages/academic/statistics/courses',
  '/pages/academic/statistics/index',
] as const

export type AcademicRefreshRoute = typeof ACADEMIC_REFRESH_ROUTES[number]

type Storage = {
  getStorageSync<T>(key: string): T | undefined
  setStorageSync<T>(key: string, value: T): void
  removeStorageSync(key: string): void
}

type RefreshSignal = {
  path: AcademicRefreshRoute
  createdAt: number
}

export const ACADEMIC_REFRESH_SIGNAL_KEY = 'campus.academicVerification.refresh.v1'
export const ACADEMIC_REFRESH_SIGNAL_TTL = 2 * 60 * 1000

const normalizePath = (value?: string) => {
  if (!value) return ''
  const path = value.split('?')[0].replace(/^\/+/, '')
  return path ? `/${path}` : ''
}

export const isAcademicRefreshRoute = (value?: string): value is AcademicRefreshRoute => (
  (ACADEMIC_REFRESH_ROUTES as readonly string[]).includes(normalizePath(value))
)

export const resolveAcademicRefreshReturnRoute = (
  returnTargetUrl?: string,
  previousPageRoute?: string,
): AcademicRefreshRoute | null => {
  // navigateBack 实际回到栈内上一页，优先以该路由决定是否刷新。
  if (isAcademicRefreshRoute(previousPageRoute)) return normalizePath(previousPageRoute) as AcademicRefreshRoute
  if (isAcademicRefreshRoute(returnTargetUrl)) return normalizePath(returnTargetUrl) as AcademicRefreshRoute
  return null
}

export const markAcademicRefreshAfterVerification = (
  storage: Storage,
  path: AcademicRefreshRoute | null,
  now = Date.now(),
) => {
  if (!path) return
  storage.setStorageSync<RefreshSignal>(ACADEMIC_REFRESH_SIGNAL_KEY, { path, createdAt: now })
}

export const consumeAcademicRefreshAfterVerification = (
  storage: Storage,
  path: string,
  now = Date.now(),
) => {
  const signal = storage.getStorageSync<RefreshSignal>(ACADEMIC_REFRESH_SIGNAL_KEY)
  if (
    !signal
    || !isAcademicRefreshRoute(signal.path)
    || !Number.isFinite(signal.createdAt)
    || now - signal.createdAt > ACADEMIC_REFRESH_SIGNAL_TTL
    || signal.createdAt > now + ACADEMIC_REFRESH_SIGNAL_TTL
  ) {
    storage.removeStorageSync(ACADEMIC_REFRESH_SIGNAL_KEY)
    return false
  }
  if (!isAcademicRefreshRoute(path) || signal.path !== normalizePath(path)) return false
  storage.removeStorageSync(ACADEMIC_REFRESH_SIGNAL_KEY)
  return true
}
