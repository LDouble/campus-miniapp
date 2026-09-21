import { strict as assert } from 'node:assert'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import Module = require('node:module')
import { resolve } from 'node:path'
import ts = require('typescript')

type Deferred<T> = {
  promise: Promise<T>
  resolve(value: T): void
  reject(error?: unknown): void
}

const deferred = <T,>(): Deferred<T> => {
  let resolvePromise!: (value: T) => void
  let rejectPromise!: (error?: unknown) => void
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })
  return { promise, resolve: resolvePromise, reject: rejectPromise }
}

const tick = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await new Promise<void>((resolve) => setImmediate(resolve))
}

const pagePath = resolve(__dirname, '../src/pages/index/index.tsx')
const pageSource = readFileSync(pagePath, 'utf8')
const oldPageSource = execFileSync('git', ['show', 'HEAD:src/pages/index/index.tsx'], {
  cwd: resolve(__dirname, '..'), encoding: 'utf8',
})

// 旧实现先 await 配置，再创建首页数据请求；配置悬挂时已缓存的动态也会被 loading 覆盖。
assert.match(oldPageSource, /const latestRuntimeConfig = await loadMiniappRuntimeConfig\(\)/)
assert.match(oldPageSource, /const \[\s*account,\s*homeFeed,\s*latestAcademic,/)

assert.match(pageSource, /const \[initialSnapshot\] = useState\(readHomeSnapshot\)/)
assert.match(pageSource, /const accountPromise = settle\(getCurrentUser\(\{ force \}\)\)/)
assert.match(pageSource, /refreshHomeSection\(\(\) => officialNoticesRepository\.feed/)
assert.match(pageSource, /homeFeedItems\.length \? '更新失败，正在显示上次内容，点击重试'/)
assert.match(pageSource, /key === homeCacheKey\(\)[\s\S]*homeFeedRequestId === homeFeedRequestSequence\.current/)

const enabledConfig = {
  campus_sections: {}, slogan_interval_ms: 3000, subscription_templates: [],
  modules: {
    community: { state: 'enabled' }, marketplace: { state: 'disabled' },
    errand: { state: 'disabled' }, carpool: { state: 'disabled' },
  },
}
const feed = (label: string) => ({
  items: [{
    source_type: 'campus_circle_post', source_id: 1, version: 1,
    author_nickname: '缓存同学', author_id: 1, author_avatar_url: null, author_deleted: false,
    feed_time: '2026-09-21T00:00:00Z', content: label, content_segments: [], images: [],
    liked_by_nicknames: [], comment_previews: [], comment_count: 0, like_count: 0,
    liked: false, section_id: 1,
  }], page: 1, total: 1,
})
const notice = (title: string) => ({ id: 1, title, source: 'academic', published_at: '2026-09-21T00:00:00Z' })

function createHarness(
  snapshot: { feed?: ReturnType<typeof feed>; notices?: ReturnType<typeof notice>[] },
  source = pageSource,
) {
  let scope = 'user-a'
  let pageSnapshot = snapshot
  const account = deferred<any>()
  const config = deferred<any>()
  const homeFeed = deferred<any>()
  let homeFeedCalls = 0
  const notices = deferred<any>()
  const hooks: any[] = []
  const effects: Array<() => void | (() => void)> = []
  let hookIndex = 0
  let rendered: any

  const React = {
    createElement: (type: any, props: any, ...children: any[]) => ({ type, props: props || {}, children }),
    useState: (initial: any) => {
      const index = hookIndex++
      if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial
      return [hooks[index], (value: any) => { hooks[index] = typeof value === 'function' ? value(hooks[index]) : value }]
    },
    useRef: (value: any) => {
      const index = hookIndex++
      if (!(index in hooks)) hooks[index] = { current: value }
      return hooks[index]
    },
    useEffect: (effect: () => void | (() => void)) => { hookIndex++; effects.push(effect) },
    useCallback: <T,>(callback: T) => { hookIndex++; return callback },
  }
  const noOp = () => undefined
  const component = new Proxy(noOp, { get: () => noOp })
  const taro = new Proxy({
    stopPullDownRefresh: async () => undefined, showToast: async () => undefined,
    navigateTo: async () => undefined, reLaunch: async () => undefined,
    pageScrollTo: async () => undefined, setStorageSync: noOp,
    useDidShow: noOp, usePageScroll: noOp, usePullDownRefresh: noOp, useReachBottom: noOp,
  }, { get: (target, property) => property in target ? (target as any)[property] : noOp })
  const homeCache = {
    homeCacheKey: () => `${scope}:home:主校区`,
    readHomeSnapshot: () => pageSnapshot,
    updateHomeSnapshot: (key: string, patch: object) => {
      if (key === `${scope}:home:主校区`) pageSnapshot = { ...pageSnapshot, ...patch }
    },
    refreshHomeSection: async (loader: () => Promise<any>, apply: (value: any) => void, isCurrent: () => boolean, failed: () => void = noOp) => {
      try { const value = await loader(); if (isCurrent()) apply(value) } catch { if (isCurrent()) failed() }
    },
  }
  const modules: Record<string, any> = {
    react: React,
    '@tarojs/taro': taro,
    '@tarojs/components': component,
    '../../features/home/page-cache': homeCache,
    '../../state/page-cache': { getCachedPageUser: () => null, getCachedPageUserId: () => 1, getPageCacheScope: () => scope, subscribePageCacheScope: () => noOp },
    '../../features/life-services/repository': { lifeServicesRepository: { listHomeFeed: () => { homeFeedCalls++; return homeFeed.promise } } },
    '../../features/official-notices/repository': { officialNoticesRepository: { feed: () => notices.promise } },
    '../../features/runtime-config': {
      getMiniappRuntimeConfig: () => enabledConfig, loadMiniappRuntimeConfig: () => config.promise,
      getSelectedCampus: () => '主校区', resolveMiniappModule: (value: any, key: string) => value.modules?.[key] || { state: 'disabled' },
      activeBanners: () => [], activeSlogans: () => [], enabledCampuses: () => ['主校区'],
      getMigrationGuideCopy: () => ({ title: '', description: '', hint: '', entry_button_text: '' }), saveSelectedCampus: noOp, openMiniappModule: async () => undefined,
    },
    '../../api/account': { getCurrentUser: () => account.promise },
    '../../api/academic-verification': { getAcademicVerificationStatus: async () => ({ identity: { status: 'unverified' } }) },
    '../../api/academic-credential': { hasAcademicCredential: () => false, getActiveAcademicUserId: () => 1 },
    '../../api/daily-checkins': { getMyDailyCheckinStatus: async () => null, createDailyCheckin: async () => ({}) },
    '../../api/calendar-reminders': { listMyCalendarReminders: async () => ({ items: [] }), deleteMyCalendarReminder: async () => undefined, putMyCalendarReminder: async () => ({}) },
    '../../api/user-levels': { listMyUserLevelTasks: async () => ({ items: [] }) },
    '../../api/auth': { isAccountCancelled: () => false },
    '../../features/notices/repository': { noticesRepository: { unreadCount: async () => ({ count: 0 }) } },
    '../../features/direct-messages/unread': { refreshPrivateMessageUnreadCount: async () => 0 },
    '../../features/wechat-subscription/request': { getWechatSubscriptionSettings: async () => ({ enabled: true }), openWechatSubscriptionSettings: noOp },
    '../../features/home/notification-guide': { readHomeNotificationGuideRecord: noOp, resolveHomeNotificationTemplateIds: () => [], saveHomeNotificationGuideRecord: noOp, shouldShowHomeNotificationGuide: () => false },
    '../../features/app-edition': { isQualificationEdition: false },
    '../../features/app-edition/navigation': { openMigratedFeaturePage: noOp },
    '../../features/academic/repository': { academicRepository: { getPeriods: async () => [], getCourses: async () => ({ records: [] }) } },
    '../academic/repository': { academicRepository: { getPeriods: async () => [], getCourses: async () => ({ records: [] }) } },
    '../academic/storage': { academicStorage: { getScheduleCache: () => null, getCustomCourses: () => [], setScheduleCache: noOp } },
    '../academic/schedule-courses': { requireCoursesForPeriod: () => [], setCoursesForPeriod: () => ({}) },
    '../academic/utils': { getAcademicCalendarLabel: () => '', getCurrentAcademicWeek: () => null, resolveScheduleAnchor: () => ({ periodId: '' }) },
    '../../features/home/data': { resolveCoursePreview: () => ({ dayLabel: '今天', dateLabel: '', total: 0, items: [], hiddenCount: 0, emptyText: '', emptyHint: '' }), tomorrowStartingPeriod: () => null, avatarText: () => '' },
    '../../features/home/feed-post-adapter': { homeFeedItemToPost: (item: any) => item, homeFeedBusinessPreview: () => null, homeFeedKey: (item: any) => `${item.source_type}-${item.source_id}`, sourceLabels: { campus_circle_post: '校园动态' } },
    '../../features/calendar/repository': { getCalendarEducationLevel: () => '', getCachedAcademicCalendar: () => ({ calendar: [] }), loadAcademicCalendar: async () => ({ source: 'unavailable', calendar: [] }) },
    '../../features/home/today': { calendarEventDateLabel: () => '', resolveTodayTask: () => null, upcomingHomeCalendarEvents: () => [] },
    '../../features/official-notices/types': { officialNoticeSourceLabels: { academic: '教务' } },
    '../../features/service-shortcuts/catalog': { allServices: [], serviceModules: {}, migratedServiceKeys: new Set() },
    '../../features/service-shortcuts/preferences': { readShortcuts: () => [] },
    '../../features/service-shortcuts/navigation': { openService: noOp }, '../../features/service-shortcuts/icons': { getServiceIcon: () => '' },
    '../../features/community/use-view-page-visible': { useViewPageVisible: () => true }, '../../features/campus-location/use-campus-location-prompt': { useCampusLocationPrompt: () => noOp },
    '../../hooks/use-collapsing-header': { useCollapsingHeader: () => false }, '../../hooks/use-load-more-signal': { useLoadMoreSignal: noOp },
    '../../utils/tabbar': { setCustomTabBarHidden: noOp, syncCustomTabBar: noOp }, '../../features/share': { useCampusShare: noOp },
    '../../features/system-theme': { getCampusTheme: () => 'light', subscribeCampusTheme: () => noOp },
    '../../features/community/comments': { mergePublicCommentPreview: () => [] }, '../../features/community/use-overlay-dismissal': { useDismissCommunityOverlaysOnScroll: noOp },
    '../../utils/action-sheet': { showActionSheetSelection: async () => null }, '../../features/class-discussion/navigation': { openClassDiscussion: async () => undefined },
    '../../features/webview/url': { normalizeWebViewUrl: (url: string) => url },
  }
  const originalLoad = (Module as any)._load
  ;(Module as any)._load = (request: string, parent: any, isMain: boolean) => {
    if (parent?.filename === pagePath) {
      if (request.endsWith('.scss') || request.endsWith('.svg')) return {}
      if (modules[request]) return modules[request]
      return component
    }
    return originalLoad(request, parent, isMain)
  }
  // 页面会注册一分钟刷新定时器；测试进程不应因它等待一个完整周期。
  ;(global as any).setInterval = () => 0
  try {
    const pageComponentName = source.includes('function IndexContent') ? 'IndexContent' : 'Index'
    const compiled = ts.transpileModule(`var __CAMPUS_APP_EDITION__ = 'full';\nvar React = require('react');\n${source}\nexports.__TestIndexContent = ${pageComponentName};`, {
      compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
      fileName: pagePath,
    }).outputText
    const loaded = new Module(pagePath, module)
    loaded.filename = pagePath
    loaded.paths = (Module as any)._nodeModulePaths(resolve(pagePath, '..'))
    ;(loaded as any)._compile(compiled, pagePath)
    const Page = (loaded.exports as any).__TestIndexContent
    const render = () => { hookIndex = 0; rendered = Page(); return rendered }
    const text = () => JSON.stringify(rendered)
    const flushEffects = () => effects.splice(0).forEach((effect) => { effect() })
    return { account, config, homeFeed, notices, render, text, flushEffects, homeFeedCalls: () => homeFeedCalls, setScope: (value: string) => { scope = value } }
  } finally {
    ;(Module as any)._load = originalLoad
  }
}

async function verifyCachedFirstScreenAndIndependentRefresh() {
  const harness = createHarness({ feed: feed('缓存动态'), notices: [notice('缓存通知')] })
  harness.render()
  assert.match(harness.text(), /缓存动态/)
  assert.match(harness.text(), /缓存通知/)
  harness.flushEffects()
  harness.homeFeed.resolve(feed('最新动态'))
  harness.notices.resolve({ items: [notice('最新通知')] })
  harness.config.resolve(enabledConfig)
  await tick()
  harness.render()
  assert.match(harness.text(), /最新动态/)
  assert.match(harness.text(), /最新通知/)
  assert.doesNotMatch(harness.text(), /正在加载校园动态/)
}

async function verifyOldConfigGate() {
  const old = createHarness({}, oldPageSource)
  old.render()
  old.flushEffects()
  await tick()
  assert.equal(old.homeFeedCalls(), 0, '旧版在配置请求悬挂时尚未启动动态请求，复现了首屏被配置阻塞的问题')
}

async function verifyFailureAndEmptyResponse() {
  const failed = createHarness({ feed: feed('保留动态') })
  failed.render(); failed.flushEffects()
  failed.homeFeed.reject(new Error('network down'))
  failed.notices.resolve({ items: [] }); failed.config.resolve(enabledConfig)
  await tick(); failed.render()
  assert.match(failed.text(), /保留动态/)
  assert.match(failed.text(), /更新失败，正在显示上次内容，点击重试/)

  const empty = createHarness({ feed: feed('旧动态') })
  empty.render(); empty.flushEffects()
  empty.homeFeed.resolve({ items: [], page: 1, total: 0 })
  empty.notices.resolve({ items: [] }); empty.config.resolve(enabledConfig)
  await tick(); empty.render()
  assert.doesNotMatch(empty.text(), /旧动态/)
  assert.match(empty.text(), /暂时没有校园动态/)
}

async function verifyScopeChangeRejectsLateResponse() {
  const harness = createHarness({ feed: feed('A 缓存') })
  harness.render(); harness.flushEffects()
  harness.setScope('user-b')
  harness.homeFeed.resolve(feed('过期 A 响应'))
  harness.notices.resolve({ items: [] }); harness.config.resolve(enabledConfig)
  await tick(); harness.render()
  assert.doesNotMatch(harness.text(), /过期 A 响应/)
  assert.match(harness.text(), /A 缓存/)
}

async function main() {
  await verifyOldConfigGate()
  await verifyCachedFirstScreenAndIndependentRefresh()
  await verifyFailureAndEmptyResponse()
  await verifyScopeChangeRejectsLateResponse()
  process.stdout.write('home offline cache smoke: ok (旧实现：配置悬挂会阻塞首屏；现实现：缓存先展示且分区并发刷新)\\n')
}

void main()
