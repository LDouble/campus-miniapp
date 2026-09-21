import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import Module = require('node:module')
import { resolve } from 'node:path'

const values = new Map<string, unknown>([
  ['campus.pageSession.v1:https://cache.example', {
    version: 1,
    generation: 3,
    user: { id: 41, username: '甲同学', avatar_url: '' },
  }],
])
const taro = {
  getStorageSync<T>(key: string) { return values.get(key) as T },
  setStorageSync<T>(key: string, value: T) { values.set(key, value) },
  getAccountInfoSync() { return { miniProgram: { envVersion: 'develop' } } },
}
const loader = Module as unknown as { _load: (...args: any[]) => any }
const originalLoad = loader._load
loader._load = function (name, ...args) {
  if (name === '@tarojs/taro') return { default: taro }
  if (name === '../api/environment') return { resolveApiBaseUrl: () => 'https://cache.example' }
  return originalLoad.call(this, name, ...args)
}

;(global as typeof globalThis & {
  __CAMPUS_REVIEW_API_BASE_URL__: string
  __CAMPUS_PRODUCTION_API_BASE_URL__: string
}).__CAMPUS_REVIEW_API_BASE_URL__ = ''
;(global as typeof globalThis & {
  __CAMPUS_REVIEW_API_BASE_URL__: string
  __CAMPUS_PRODUCTION_API_BASE_URL__: string
}).__CAMPUS_PRODUCTION_API_BASE_URL__ = ''

const {
  getCachedPageUserId,
  getPageCacheScope,
  saveCachedPageUser,
  subscribePageCacheScope,
} = require('../src/state/page-cache') as typeof import('../src/state/page-cache')
loader._load = originalLoad

assert.equal(getCachedPageUserId(), 41, '冷启动应同步恢复展示身份，不依赖网络或教务凭据')
const firstScope = getPageCacheScope()
let notifications = 0
const unsubscribe = subscribePageCacheScope(() => { notifications += 1 })
saveCachedPageUser({ id: 84, username: '乙同学' })
unsubscribe()
assert.equal(getCachedPageUserId(), 84, '账号切换后应切换展示身份')
assert.notEqual(getPageCacheScope(), firstScope, '账号切换必须生成新页面缓存作用域')
assert.equal(notifications, 1, '账号切换必须通知页面卸载旧请求和状态')

const schedulePageSource = readFileSync(
  resolve(__dirname, '../src/pages/academic/schedule/index.tsx'),
  'utf8',
)
assert.match(
  schedulePageSource,
  /key=\{pageCacheScope\}[\s\S]*?academicUserId=\{getCachedPageUserId\(\)\}/u,
  '课表页必须以展示身份作用域重挂载，冷启动直接读取对应账号缓存',
)
assert.match(
  schedulePageSource,
  /isCurrentPageCacheScope\(\)[\s\S]*?academicStorage\.setScheduleCache/u,
  '过期账号作用域的课表响应不得写入缓存',
)
assert.match(
  schedulePageSource,
  /isCurrentPageCacheScope\(\)[\s\S]*?setPersonalCourses/u,
  '过期账号作用域的蹭课响应不得覆盖新账号状态',
)

// 使用真实课表组件、最小 Hook 运行器和可控请求验证首屏状态，而不把离线
// 行为退化为仅检查源码字符串。
void (async () => {
const TypeScript = require('typescript') as typeof import('typescript')
const schedulePagePath = resolve(__dirname, '../src/pages/academic/schedule/index.tsx')
const originalTsx = require.extensions['.tsx']
const originalLoader = loader._load
const course = {
  id: 'cached-course', periodId: 'period-1', name: '缓存课程', teacher: '教师', location: 'A101',
  weekday: 1, startSection: 1, endSection: 2, weeks: [1], color: 'aqua', source: 'official',
}
const periods = [{ id: 'period-1', label: '当前学期', shortLabel: '当前', startDate: '2026/09/01', weeks: 20, isCurrent: true }]
const scheduleCache = {
  version: 1 as const, platformUserId: 41, periods, coursesByPeriod: { 'period-1': [course] },
  coursesUpdatedAtByPeriod: { 'period-1': 1 }, scheduleNotesByPeriod: {},
}
let scope = 'scope-A'
let resolvePeriods: ((value: typeof periods) => void) | undefined
let rejectPeriods: ((error: Error) => void) | undefined
let scheduleWrites = 0
const deferredPeriods = () => new Promise<typeof periods>((resolvePromise, rejectPromise) => {
  resolvePeriods = resolvePromise
  rejectPeriods = rejectPromise
})
const academicStorage = {
  getScheduleCache: (userId: number) => userId === 41 ? scheduleCache : null,
  setScheduleCache: () => { scheduleWrites += 1 },
  getPreferences: (fallback: unknown) => fallback,
  setPreferences: () => undefined,
  getCustomCourses: () => [], setCustomCourses: () => undefined,
  getPersonalCourses: () => [], setPersonalCourses: () => undefined,
  getSelectionDraftCourses: () => [], setSelectionDraftCourses: () => undefined,
  getCourseSelectionScheduleCourses: () => [], setCourseSelectionScheduleCourses: () => undefined,
  hasSeenScheduleRefreshGuideToday: () => true, markScheduleRefreshGuideSeenToday: () => undefined,
  hasSeenScheduleSelectionGuideToday: () => true, markScheduleSelectionGuideSeenToday: () => undefined,
}
const hooks: unknown[] = []
const effects: Array<{ run: () => void | (() => void); ran: boolean }> = []
let hookIndex = 0
const react = {
  useState: <T,>(initial: T | (() => T)) => {
    const index = hookIndex++
    if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? (initial as () => T)() : initial
    return [hooks[index] as T, (value: T | ((current: T) => T)) => {
      hooks[index] = typeof value === 'function' ? (value as (current: T) => T)(hooks[index] as T) : value
    }] as const
  },
  useRef: <T,>(value: T) => ({ current: value }),
  useMemo: <T,>(factory: () => T) => { hookIndex += 1; return factory() },
  useCallback: <T extends Function>(callback: T) => { hookIndex += 1; return callback },
  useEffect: (run: () => void | (() => void)) => { effects[hookIndex++] = { run, ran: false } },
  createElement: (type: unknown, props: unknown, ...children: unknown[]) => ({ type, props, children }),
}
const proxy = new Proxy({}, { get: (_target, key) => key === '__esModule' ? false : () => undefined })
const taroPage = {
  useRouter: () => ({ params: {} }), useDidShow: () => undefined, usePullDownRefresh: () => undefined,
  showToast: () => undefined, nextTick: (callback: () => void) => callback(), createSelectorQuery: () => ({ select: () => ({ boundingClientRect: () => undefined }), exec: () => undefined }),
}
require.extensions['.tsx'] = (module, filename) => {
  if (filename !== schedulePagePath || !originalTsx) return originalTsx?.(module, filename)
  const output = TypeScript.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: TypeScript.ModuleKind.CommonJS, jsx: TypeScript.JsxEmit.ReactJSX },
  }).outputText
  module._compile(output, filename)
}
loader._load = function (name, parent, ...args) {
  if (parent?.filename !== schedulePagePath) return originalLoader.call(this, name, parent, ...args)
  if (name === 'react') return react
  if (name === 'react/jsx-runtime') return { jsx: react.createElement, jsxs: react.createElement, Fragment: 'fragment' }
  if (name === '@tarojs/taro') return { default: taroPage }
  if (name === '@tarojs/components') return new Proxy({}, { get: () => () => undefined })
  if (name === '../storage') return { academicStorage }
  if (name === '../repository') return {
    academicRepository: { getPeriods: deferredPeriods, getCourses: deferredPeriods, getCourseSelectionSchedule: deferredPeriods },
    mapPersonalTimetableItemCourses: () => [],
  }
  if (name === '../schedule-courses') return {
    sanitizeCoursesByPeriod: (value: unknown) => value,
    getCoursesForPeriod: (value: Record<string, unknown[]>, periodId: string) => value[periodId] || [],
    getCoursesForWeek: (value: unknown[]) => value,
    setCoursesForPeriod: (value: Record<string, unknown[]>, periodId: string, records: unknown[]) => ({ ...value, [periodId]: records }),
    requireCoursesForPeriod: (value: unknown[]) => value,
    mergeSimulationCourses: (left: unknown[], right: unknown[]) => [...left, ...right],
    getCourseScheduleKey: () => '',
  }
  if (name === '../utils') return {
    courseColors: ['aqua'], weekdays: ['一'], getAcademicWeekday: () => 1, getCurrentTeachingWeek: () => 1,
    getWeekDates: () => [], resolveScheduleAnchor: (records: typeof periods) => ({ periodId: records[0]?.id || '', week: 1 }),
    resolvePeriodId: (records: typeof periods) => records[0]?.id || '', resolveNextPeriodId: () => '',
    formatCourseTimeRange: () => '', formatCourseWeeks: () => '', formatPeriodStartDate: () => '', formatMonthDay: () => '',
    isSameDay: () => false, resolveHorizontalSwipeDay: () => ({ week: 1, weekday: 1 }), resolveHorizontalSwipeWeek: () => 1,
  }
  if (name === '../../../state/page-cache') return { getPageCacheScope: () => scope, getCachedPageUserId: () => 41, subscribePageCacheScope: () => () => undefined }
  if (name === '../../../api/academic-credential') return { loadAcademicCredential: () => ({ educationLevel: 'undergraduate' }) }
  if (name === '../../../features/runtime-config') return { getMiniappRuntimeConfig: () => ({}), getSelectedCampus: () => '', loadMiniappRuntimeConfig: async () => ({}), getSectionStartTime: () => '', getSectionEndTime: () => '' }
  if (name === '../../../api/personal-timetable') return { listPersonalTimetableItems: async () => ({ items: [] }), removePersonalTimetableItem: async () => undefined }
  return proxy
}

delete require.cache[schedulePagePath]
const { SchedulePageContent } = require(schedulePagePath) as typeof import('../src/pages/academic/schedule/index')
const renderSchedule = () => {
  hookIndex = 0
  return SchedulePageContent({ academicUserId: 41, pageCacheScope: 'scope-A' })
}
const containsCachedCourse = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.some(containsCachedCourse)
  if (!value || typeof value !== 'object') return false
  if ((value as { id?: string }).id === course.id) return true
  return Object.values(value as Record<string, unknown>).some(containsCachedCourse)
}
renderSchedule()
effects.filter((effect) => !effect.ran).forEach((effect) => { effect.ran = true; effect.run() })
assert.ok(containsCachedCourse(hooks), '授权请求挂起时，首屏必须已装入当前账号的官方课表缓存')
scope = 'scope-B'
resolvePeriods?.(periods)
await Promise.resolve()
assert.equal(scheduleWrites, 0, '账号切换后旧课表请求不得写入旧作用域缓存')
scope = 'scope-A'
hooks.length = 0
effects.length = 0
resolvePeriods = undefined
rejectPeriods = undefined
renderSchedule()
effects.filter((effect) => !effect.ran).forEach((effect) => { effect.ran = true; effect.run() })
rejectPeriods?.(new Error('authorization unavailable'))
await Promise.resolve()
renderSchedule()
assert.ok(containsCachedCourse(hooks), '授权服务失败不得遮蔽已显示的课表缓存')
loader._load = originalLoader
require.extensions['.tsx'] = originalTsx
delete require.cache[schedulePagePath]

process.stdout.write('schedule offline cache smoke: ok\n')
})().catch((error) => {
  process.exitCode = 1
  throw error
})
