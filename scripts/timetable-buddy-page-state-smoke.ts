import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Module = require('node:module')
import * as ts from 'typescript'
import * as invitationState from '../src/features/timetable-buddy/invitation-state'
import * as stateCoordinator from '../src/features/timetable-buddy/state-coordinator'

type AnyFunction = (...args: any[]) => any
type HookSlot = { value: any; deps?: readonly unknown[]; cleanup?: AnyFunction; initialized?: boolean }
type HookHost = {
  cursor: number
  slots: HookSlot[]
  pendingEffects: Array<{ index: number; effect: AnyFunction }>
  unmounted: boolean
  postUnmountStateUpdates: number
}
type ViewNode = { type: unknown; props: Record<string, any> }
type Connection = {
  id: number
  relationType: string
  createdAt: string
  members: Array<{ userId: number; nickname: string; avatarUrl: string; shareScope: 'busy' | 'details'; paused: boolean }>
}

const pagePath = resolve(__dirname, '../src/pages/academic/timetable-buddy/index.tsx')
const originalLoad = (Module as unknown as { _load: AnyFunction })._load
let activeHarness: PageHarness | null = null
let currentHookHost: HookHost | null = null

const sameDeps = (left?: readonly unknown[], right?: readonly unknown[]) => (
  left === right || Boolean(left && right && left.length === right.length && left.every((value, index) => Object.is(value, right[index])))
)

const nextSlot = () => {
  if (!currentHookHost) throw new Error('hook called outside a rendered page')
  const host = currentHookHost
  const index = host.cursor++
  host.slots[index] ||= { value: undefined }
  return { host, index, slot: host.slots[index] }
}

const mockReact = {
  useState<T>(initial: T | (() => T)): [T, (value: T | ((current: T) => T)) => void] {
    const { host, slot } = nextSlot()
    if (!slot.initialized) {
      slot.value = typeof initial === 'function' ? (initial as () => T)() : initial
      slot.initialized = true
    }
    return [slot.value as T, (value) => {
      if (host.unmounted) host.postUnmountStateUpdates += 1
      slot.value = typeof value === 'function' ? (value as (current: T) => T)(slot.value as T) : value
    }]
  },
  useRef<T>(initial: T) {
    const { slot } = nextSlot()
    if (!slot.initialized) {
      slot.value = { current: initial }
      slot.initialized = true
    }
    return slot.value as { current: T }
  },
  useCallback<T extends AnyFunction>(callback: T, deps: readonly unknown[]) {
    const { slot } = nextSlot()
    if (!slot.initialized || !sameDeps(slot.deps, deps)) {
      slot.value = callback
      slot.deps = deps
      slot.initialized = true
    }
    return slot.value as T
  },
  useMemo<T>(factory: () => T, deps: readonly unknown[]) {
    const { slot } = nextSlot()
    if (!slot.initialized || !sameDeps(slot.deps, deps)) {
      slot.value = factory()
      slot.deps = deps
      slot.initialized = true
    }
    return slot.value as T
  },
  useEffect(effect: AnyFunction, deps?: readonly unknown[]) {
    const { host, index, slot } = nextSlot()
    if (!slot.initialized || !sameDeps(slot.deps, deps)) {
      slot.deps = deps
      slot.initialized = true
      host.pendingEffects.push({ index, effect })
    }
  },
}

const makeNode = (type: unknown, props: Record<string, any> = {}): ViewNode => ({ type, props })
const jsxRuntime = {
  Fragment: Symbol('Fragment'),
  jsx: (type: unknown, props: Record<string, any>, key?: string) => makeNode(type, key === undefined ? props : { ...props, key }),
  jsxs: (type: unknown, props: Record<string, any>, key?: string) => makeNode(type, key === undefined ? props : { ...props, key }),
}

const cloneConnection = (connection: Connection | null): Connection | null => (
  connection ? JSON.parse(JSON.stringify(connection)) as Connection : null
)

const makeConnection = (scope: 'busy' | 'details' = 'busy'): Connection => ({
  id: 41,
  relationType: 'friend',
  createdAt: '2026-10-04T00:00:00Z',
  members: [
    { userId: 1, nickname: '我', avatarUrl: '', shareScope: scope, paused: false },
    { userId: 2, nickname: '搭子', avatarUrl: '', shareScope: 'busy', paused: false },
  ],
})

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

class PageHarness {
  connection: Connection | null
  token: string
  getStateCalls = 0
  getScheduleCalls = 0
  createInvitationCalls = 0
  readonly createInvitationInputs: Array<{
    relationType: string
    shareScope: string
    expiresInHours: number
  }> = []
  revokeInvitationCalls = 0
  updateSettingsCalls = 0
  disconnectCalls = 0
  acceptCalls = 0
  createConversationCalls = 0
  openModuleCalls = 0
  modalConfirm = true
  nextCreateInvitation: ReturnType<typeof deferred<{ token: string; expiresAt: string }>> | null = null
  nextRevokeInvitation: ReturnType<typeof deferred<void>> | null = null
  nextUpdateSettings: ReturnType<typeof deferred<void>> | null = null
  nextCreateConversation: ReturnType<typeof deferred<{ id: number }>> | null = null
  readonly toastTitles: string[] = []
  nextGetState: (() => Promise<{ connection: Connection | null }>) | null = null
  readonly wrapperHost: HookHost = { cursor: 0, slots: [], pendingEffects: [], unmounted: false, postUnmountStateUpdates: 0 }
  contentHost: HookHost = { cursor: 0, slots: [], pendingEffects: [], unmounted: false, postUnmountStateUpdates: 0 }
  tree: ViewNode | null = null
  shareMessage: AnyFunction = () => ({ query: {} })
  didShow: AnyFunction = () => undefined
  pullDown: AnyFunction = () => undefined
  pageCacheScope = 'test-scope'
  userId = 1
  readonly pageCacheScopeListeners = new Set<AnyFunction>()
  private renderedContentKey: unknown
  private readonly component: AnyFunction

  constructor(connection: Connection | null, token = '', readonly legacyMode = false) {
    this.connection = cloneConnection(connection)
    this.token = token
    activeHarness = this
    let source = readFileSync(pagePath, 'utf8')
    if (legacyMode) {
      const beforeMutationTransform = source
      source = source.replace(
        /const finishRelationMutation = \(ticket: number\) => \{\s*if \(!stateCoordinator\.finishMutation\(ticket\)\) return\s*scheduleRequest\.current \+= 1\s*requestStateRefresh\(\)\s*\}/u,
        'const finishRelationMutation = (ticket: number) => { stateCoordinator.finishMutation(ticket) }',
      )
      assert.notEqual(source, beforeMutationTransform, 'legacy fault injection must remove mutation refresh')
      const beforeShowTransform = source
      source = source.replace(
        /useDidShow\(\(\) => \{\n    setStateLoading\(true\)/u,
        'useDidShow(() => {',
      )
      const beforeShowRefreshTransform = source
      source = source.replace(
        /(useDidShow\(\(\) => \{[\s\S]*?)    requestStateRefresh\(\)\n  \}\)/u,
        '$1  })',
      )
      assert.notEqual(source, beforeShowTransform, 'legacy fault injection must remove show loading state')
      assert.notEqual(source, beforeShowRefreshTransform, 'legacy fault injection must remove show refresh')
    }
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
      fileName: pagePath,
    }).outputText
    const pageModule = new Module(pagePath, module)
    pageModule.filename = pagePath
    pageModule.paths = Module._nodeModulePaths(resolve(pagePath, '../..'))
    ;(Module as unknown as { _load: AnyFunction })._load = (request, parent, isMain) => {
      if (parent?.filename === pagePath) return loadPageDependency(request)
      return originalLoad.call(Module, request, parent, isMain)
    }
    try {
      pageModule._compile(compiled, pagePath)
    } finally {
      ;(Module as unknown as { _load: AnyFunction })._load = originalLoad
    }
    this.component = pageModule.exports.default
  }

  private commitEffects(host: HookHost) {
    const pending = host.pendingEffects.splice(0)
    for (const { index, effect } of pending) {
      host.slots[index].cleanup?.()
      host.slots[index].cleanup = effect()
    }
  }

  private renderFunction(component: AnyFunction, props: Record<string, any>, host: HookHost) {
    host.cursor = 0
    currentHookHost = host
    try {
      return component(props) as ViewNode
    } finally {
      currentHookHost = null
    }
  }

  render() {
    const wrapper = this.renderFunction(this.component, {}, this.wrapperHost)
    const contentKey = wrapper.props.key
    if (this.renderedContentKey !== undefined && contentKey !== this.renderedContentKey) {
      this.disposeHost(this.contentHost)
      this.contentHost = this.createHookHost()
    }
    this.renderedContentKey = contentKey
    this.tree = this.renderFunction(wrapper.type as AnyFunction, wrapper.props, this.contentHost)
    this.commitEffects(this.wrapperHost)
    this.commitEffects(this.contentHost)
  }

  async settle(rounds = 18) {
    for (let index = 0; index < rounds; index += 1) {
      this.render()
      await Promise.resolve()
    }
    this.render()
    await Promise.resolve()
    this.render()
  }

  private createHookHost(): HookHost {
    return { cursor: 0, slots: [], pendingEffects: [], unmounted: false, postUnmountStateUpdates: 0 }
  }

  private disposeHost(host: HookHost) {
    host.unmounted = true
    for (const slot of [...host.slots].reverse()) slot.cleanup?.()
  }

  switchAccount(pageCacheScope: string, userId: number, connection: Connection | null) {
    this.pageCacheScope = pageCacheScope
    this.userId = userId
    this.connection = cloneConnection(connection)
    for (const listener of this.pageCacheScopeListeners) listener()
  }

  unmount() {
    this.disposeHost(this.contentHost)
    this.disposeHost(this.wrapperHost)
  }

  findByLabel(label: string) {
    const visit = (node: unknown): ViewNode | null => {
      if (Array.isArray(node)) {
        for (const child of node) {
          const found = visit(child)
          if (found) return found
        }
        return null
      }
      if (!node || typeof node !== 'object') return null
      const candidate = node as ViewNode
      if (candidate.props?.ariaLabel === label) return candidate
      return visit(candidate.props?.children)
    }
    return visit(this.tree)
  }

  findClickableByText(value: string) {
    const textOf = (node: unknown): string => {
      if (typeof node === 'string' || typeof node === 'number') return String(node)
      if (Array.isArray(node)) return node.map(textOf).join('')
      if (!node || typeof node !== 'object') return ''
      return textOf((node as ViewNode).props?.children)
    }
    const visit = (node: unknown): ViewNode | null => {
      if (Array.isArray(node)) {
        for (const child of node) {
          const found = visit(child)
          if (found) return found
        }
        return null
      }
      if (!node || typeof node !== 'object') return null
      const candidate = node as ViewNode
      if (typeof candidate.props?.onClick === 'function' && textOf(candidate).includes(value)) return candidate
      return visit(candidate.props?.children)
    }
    return visit(this.tree)
  }

  hasText(value: string) {
    const textOf = (node: unknown): string => {
      if (typeof node === 'string' || typeof node === 'number') return String(node)
      if (Array.isArray(node)) return node.map(textOf).join('')
      if (!node || typeof node !== 'object') return ''
      return textOf((node as ViewNode).props?.children)
    }
    return textOf(this.tree).includes(value)
  }

  activeScope() {
    const item = this.findByLabel('课程详情') || this.findByLabel('设置为课程详情')
    return Boolean(item?.props.className?.includes('--active'))
  }

  activeRelation() {
    const item = this.findByLabel('课表 CP')
    return Boolean(item?.props.className?.includes('--active'))
  }

  async waitFor(predicate: () => boolean, message: string) {
    for (let index = 0; index < 30; index += 1) {
      await Promise.resolve()
      this.render()
      if (predicate()) return
    }
    assert.fail(message)
  }

  async waitWithoutRender(predicate: () => boolean, message: string) {
    for (let index = 0; index < 30; index += 1) {
      await Promise.resolve()
      if (predicate()) return
    }
    assert.fail(message)
  }

  async drainMicrotasks(rounds = 8) {
    for (let index = 0; index < rounds; index += 1) await Promise.resolve()
  }
}

const currentPeriod = {
  id: '2026-fall', label: '2026 秋', shortLabel: '秋季学期', startDate: '2026-09-01', weeks: 20, isCurrent: true,
}

const loadPageDependency = (request: string): unknown => {
  if (request === 'react') return mockReact
  if (request === 'react/jsx-runtime') return jsxRuntime
  if (request === '@tarojs/components') return { Button: 'Button', Picker: 'Picker', Text: 'Text', View: 'View' }
  if (request === '@tarojs/taro') return {
    __esModule: true,
    default: {
      useRouter: () => ({ params: { token: activeHarness?.token || '' } }),
      showToast: (value: { title?: string }) => { if (activeHarness && value.title) activeHarness.toastTitles.push(value.title) },
      showModal: async () => ({ confirm: activeHarness?.modalConfirm ?? true }),
      stopPullDownRefresh: () => undefined,
      navigateTo: async () => undefined,
    },
    useDidShow: (callback: AnyFunction) => { if (activeHarness) activeHarness.didShow = callback },
    useLoad: () => undefined,
    usePullDownRefresh: (callback: AnyFunction) => { if (activeHarness) activeHarness.pullDown = callback },
    useShareAppMessage: (callback: AnyFunction) => { if (activeHarness) activeHarness.shareMessage = callback },
  }
  if (request.endsWith('.scss')) return {}
  if (request === '../../../api/client') return {
    isApiError: (error: unknown) => Boolean(error && typeof error === 'object' && (error as { testApiError?: boolean }).testApiError),
  }
  if (request === '../../../api/auth') return { login: async () => undefined }
  if (request === '../../../api/account') return { getCurrentIdentity: async () => undefined }
  if (request === '../../../api/academic-credential') return {
    loadAcademicCredential: () => ({ educationLevel: 'undergraduate' }),
  }
  if (request === '../storage') return {
    academicStorage: {
      getScheduleCache: () => ({ periods: [currentPeriod] }),
      getPreferences: (fallback: unknown) => fallback,
      getCustomCourses: () => [],
    },
  }
  if (request === '../utils') return {
    formatMonthDay: () => '10月4日',
    getAcademicWeekday: () => 1,
    getCurrentTeachingWeek: () => 1,
    getWeekDates: () => [],
    resolveDefaultPeriodId: (periods: Array<{ id: string }>) => periods[0]?.id || '',
    resolveRetainedPeriodId: (periods: Array<{ id: string }>, id: string) => periods.some((period) => period.id === id) ? id : '',
    weekdays: ['一', '二', '三', '四', '五', '六', '日'],
  }
  if (request === '../../../state/page-cache') return {
    getCachedPageUserId: () => requireHarness().userId,
    getPageCacheScope: () => requireHarness().pageCacheScope,
    subscribePageCacheScope: (listener: AnyFunction) => {
      const harness = requireHarness()
      harness.pageCacheScopeListeners.add(listener)
      return () => harness.pageCacheScopeListeners.delete(listener)
    },
  }
  if (request === '../../../components/custom-navbar') return { default: () => null }
  if (request === '../../../features/share') return { buildCampusShareMessage: (value: unknown) => value }
  if (request === '../../../features/runtime-config') return {
    openMiniappModule: async () => { if (activeHarness) activeHarness.openModuleCalls += 1; return true },
    loadMiniappRuntimeConfig: async () => ({}),
    resolveMiniappModule: () => ({ state: 'enabled' }),
  }
  if (request === '../../../features/wechat-subscription') return { requestWechatSubscriptionForModule: () => false }
  if (request === '../../../features/direct-messages/navigation') return {
    directMessageChatUrl: (id: number) => `/chat?id=${id}`,
    directMessagesListUrl: '/messages',
  }
  if (request === '../../../features/direct-messages/repository') return {
    privateMessagesRepository: { createConversation: async () => {
      const harness = requireHarness()
      harness.createConversationCalls += 1
      if (harness.nextCreateConversation) return harness.nextCreateConversation.promise
      return { id: 1 }
    } },
  }
  if (request === '../../../api/timetable-buddy') return {
    timetableBuddyRepository: {
      getState: async () => {
        const harness = requireHarness()
        harness.getStateCalls += 1
        if (harness.nextGetState) {
          const next = harness.nextGetState
          harness.nextGetState = null
          return next()
        }
        return { connection: cloneConnection(harness.connection) }
      },
      createInvitation: async (input: { relationType: string; shareScope: string; expiresInHours: number }) => {
        const harness = requireHarness()
        harness.createInvitationCalls += 1
        harness.createInvitationInputs.push(input)
        if (harness.nextCreateInvitation) return harness.nextCreateInvitation.promise
        return { token: 'b'.repeat(64), expiresAt: 'later' }
      },
      revokeInvitation: async () => {
        const harness = requireHarness()
        harness.revokeInvitationCalls += 1
        if (harness.nextRevokeInvitation) await harness.nextRevokeInvitation.promise
        return { connection: cloneConnection(harness.connection) }
      },
      previewInvitation: async () => ({ creatorNickname: '邀请人', relationType: 'friend', expiresAt: 'later' }),
      acceptInvitation: async () => {
        const harness = requireHarness()
        harness.acceptCalls += 1
        harness.connection = makeConnection()
        return { connection: cloneConnection(harness.connection) }
      },
      syncCustomCourses: async () => undefined,
      getSchedule: async () => {
        const harness = requireHarness()
        harness.getScheduleCalls += 1
        if (!harness.connection) {
          throw Object.assign(new Error('课表搭子关系已变化'), {
            testApiError: true,
            code: 'timetable_buddy_not_found',
          })
        }
        const side = {
          userId: 1, nickname: '我', shareScope: 'busy', paused: false, syncedAt: 'now', dataStatus: 'ready',
          customCoursesReady: true, customCoursesSyncedAt: 'now', courses: [], busySlots: [],
        }
        return { connection: cloneConnection(harness.connection), me: side, buddy: { ...side, userId: 2, nickname: '搭子' }, commonFreeSlots: [] }
      },
      updateSettings: async ({ shareScope, paused }: { shareScope: 'busy' | 'details'; paused: boolean }) => {
        const harness = requireHarness()
        harness.updateSettingsCalls += 1
        if (harness.nextUpdateSettings) await harness.nextUpdateSettings.promise
        if (!harness.connection) throw new Error('connection changed')
        harness.connection = {
          ...harness.connection,
          members: harness.connection.members.map((member) => member.userId === 1 ? { ...member, shareScope, paused } : member),
        }
        return { connection: cloneConnection(harness.connection) }
      },
      disconnect: async () => {
        const harness = requireHarness()
        harness.disconnectCalls += 1
        harness.connection = null
        return { connection: null }
      },
    },
  }
  if (request === '../../../features/timetable-buddy/model') return {
    timetableBuddyRelationLabel: (value: string) => ({ friend: '朋友', study_partner: '学习搭子', cp: '课表 CP', unspecified: '未指定' }[value] || value),
    timetableBuddyScopeLabel: (value: string) => value === 'details' ? '课程详情' : '仅忙闲',
    isTimetableBuddyInvitationToken: (value: string) => /^[a-f0-9]{64}$/u.test(value),
  }
  if (request === '../../../features/timetable-buddy/custom-courses') return {
    buildTimetableBuddyCustomCourses: () => [],
    syncTimetableBuddyCustomCoursesSerially: async (input: { read: () => unknown; upload: (value: unknown) => Promise<unknown> }) => input.upload(input.read()),
  }
  if (request === '../../../features/timetable-buddy/invitation-state') return invitationState
  if (request === '../../../features/timetable-buddy/state-coordinator') {
    if (!activeHarness?.legacyMode) return stateCoordinator
    return {
      createTimetableBuddyStateCoordinator: () => {
        let readTicket = 0
        let mutationTicket = 0
        let activeMutation: number | null = null
        return {
          beginRead: () => ++readTicket,
          isReadCurrent: (ticket: number) => ticket === readTicket,
          invalidateReads: () => undefined,
          beginMutation: () => {
            if (activeMutation !== null) return null
            activeMutation = ++mutationTicket
            return activeMutation
          },
          isMutationCurrent: (ticket: number) => ticket === activeMutation,
          finishMutation: (ticket: number) => {
            if (ticket !== activeMutation) return false
            activeMutation = null
            return true
          },
        }
      },
    }
  }
  if (request === '../../../features/timetable-buddy/custom-courses-storage') return {
    readTimetableBuddyCustomCoursesForSharing: () => [],
  }
  if (request === '../../../features/timetable-buddy/availability') return {
    hasBusySlot: () => false,
    slotsForWeek: () => [],
  }
  throw new Error(`Unexpected timetable buddy page dependency: ${request}`)
}

const requireHarness = () => {
  if (!activeHarness) throw new Error('no active page harness')
  return activeHarness
}

const hasVisibleConnection = (harness: PageHarness) => Boolean(harness.findByLabel('解除课表搭子关系'))

const makeHarness = async (connection: Connection | null, token = '', legacyMode = false) => {
  const harness = new PageHarness(connection, token, legacyMode)
  await harness.settle()
  return harness
}

const startStaleRead = async (harness: PageHarness) => {
  const response = deferred<{ connection: Connection | null }>()
  const snapshot = cloneConnection(harness.connection)
  const callCount = harness.getStateCalls
  harness.nextGetState = () => response.promise
  harness.pullDown()
  await harness.waitFor(() => harness.getStateCalls > callCount, '下拉刷新没有启动状态读取')
  return { response, snapshot }
}

const completeAuthoritativeStateRefresh = async (harness: PageHarness) => {
  const response = deferred<{ connection: Connection | null }>()
  const callsBeforeRefresh = harness.getStateCalls
  harness.nextGetState = () => response.promise
  await harness.waitFor(() => harness.getStateCalls > callsBeforeRefresh, 'mutation 完成后没有启动新的权威关系读取')
  response.resolve({ connection: cloneConnection(harness.connection) })
  await harness.settle()
}

const testReadCompletedBeforeMutation = async () => {
  const harness = await makeHarness(makeConnection('busy'))
  const oldRead = await startStaleRead(harness)
  oldRead.response.resolve({ connection: oldRead.snapshot })
  await harness.settle()
  assert.equal(harness.activeScope(), false, 'mutation 前完成的关系读取应展示原有服务端状态')

  harness.findByLabel('设置为课程详情')?.props.onClick()
  await harness.settle()
  assert.equal(harness.activeScope(), true, '旧 GET 已完成后发起的设置 mutation 应保留最新设置')
}

const testSettingsCannotBeRolledBackByOldRead = async () => {
  const harness = await makeHarness(makeConnection('busy'))
  const settingsButton = harness.findByLabel('设置为课程详情')
  assert.ok(settingsButton, '初始关系页应显示课程详情设置项')
  const stale = await startStaleRead(harness)
  const update = deferred<void>()
  harness.nextUpdateSettings = update
  settingsButton?.props.onClick()
  await harness.waitFor(() => harness.updateSettingsCalls === 1, '设置 mutation 没有启动')
  const readsWhileMutationActive = harness.getStateCalls
  harness.pullDown()
  await harness.waitFor(() => true, '刷新请求未提交')
  assert.equal(harness.getStateCalls, readsWhileMutationActive, 'mutation 进行中下拉刷新不得另起关系读取')
  update.resolve()
  harness.nextUpdateSettings = null
  await harness.waitWithoutRender(() => harness.toastTitles.includes('分享设置已更新'), '分享范围修改未完成')
  assert.equal(harness.updateSettingsCalls, 1, '设置 mutation 应已成功执行')
  assert.equal(harness.connection?.members[0].shareScope, 'details')
  await completeAuthoritativeStateRefresh(harness)
  assert.equal(harness.activeScope(), true, 'mutation 后新的权威 GET 应确认详情分享范围')
  stale.response.resolve({ connection: stale.snapshot })
  await harness.drainMicrotasks()
  harness.render()
  assert.equal(harness.activeScope(), true, '在新权威 GET 完成后才返回的旧 GET 不得回滚分享范围')
  await harness.settle()
}

const testOldReadCompletesDuringMutation = async () => {
  const harness = await makeHarness(makeConnection('busy'))
  const settingsButton = harness.findByLabel('设置为课程详情')
  const stale = await startStaleRead(harness)
  const update = deferred<void>()
  harness.nextUpdateSettings = update
  settingsButton?.props.onClick()
  await harness.waitFor(() => harness.updateSettingsCalls === 1, '并发时序中的设置 mutation 没有启动')

  stale.response.resolve({ connection: stale.snapshot })
  await harness.drainMicrotasks()
  harness.render()
  assert.equal(harness.connection?.members[0].shareScope, 'busy', 'mutation 进行中返回的旧 GET 不得写入连接状态')
  assert.equal(harness.activeScope(), false, 'mutation 进行中旧 GET 不得提前改变可见分享范围')

  const callsWhileMutationActive = harness.getStateCalls
  harness.pullDown()
  await harness.waitFor(() => true, 'mutation 期间刷新没有处理')
  assert.equal(harness.getStateCalls, callsWhileMutationActive, 'mutation 进行中的 pull 不得发起额外关系 GET')
  update.resolve()
  harness.nextUpdateSettings = null
  await harness.waitWithoutRender(() => harness.toastTitles.includes('分享设置已更新'), '并发时序中的设置 mutation 未完成')
  await completeAuthoritativeStateRefresh(harness)
  assert.equal(harness.activeScope(), true, 'mutation 完成后权威读取应显示新分享范围')
}

const testDisconnectCannotBeRevertedByOldRead = async () => {
  const harness = await makeHarness(makeConnection())
  const disconnectButton = harness.findByLabel('解除课表搭子关系')
  assert.ok(disconnectButton, '初始关系页应显示解除入口')
  const stale = await startStaleRead(harness)
  disconnectButton?.props.onClick()
  await harness.waitWithoutRender(() => harness.toastTitles.includes('已解除课表搭子关系'), '解除关系 mutation 未完成')
  assert.equal(harness.disconnectCalls, 1, '解除 mutation 应已成功执行')
  assert.equal(harness.connection, null)
  await completeAuthoritativeStateRefresh(harness)
  assert.equal(hasVisibleConnection(harness), false, '新权威 GET 应确认关系已解除')
  stale.response.resolve({ connection: stale.snapshot })
  await harness.drainMicrotasks()
  harness.render()
  assert.equal(hasVisibleConnection(harness), false, '较早的 GET 不得恢复已解除的关系')
  await harness.settle()
}

const testAcceptStillCompletesAcrossRefresh = async () => {
  const harness = await makeHarness(null, 'a'.repeat(64))
  const acceptButton = harness.findByLabel('接受课表搭子邀请')
  assert.ok(acceptButton, '有效邀请预览应显示接受入口')
  const stale = await startStaleRead(harness)
  acceptButton?.props.onClick()
  await harness.waitWithoutRender(() => harness.toastTitles.includes('已成为课表搭子'), '接受邀请 mutation 未完成')
  assert.equal(harness.acceptCalls, 1, '接受邀请 mutation 应成功执行')
  assert.ok(harness.connection, '接受成功后应进入已连接状态')
  await completeAuthoritativeStateRefresh(harness)
  assert.equal(hasVisibleConnection(harness), true, '新权威 GET 应确认接受后的关系')
  stale.response.resolve({ connection: null })
  await harness.drainMicrotasks()
  harness.render()
  assert.equal(hasVisibleConnection(harness), true, '旧的无关系响应不得覆盖接受成功后的关系')
  await harness.settle()
}

const testShowRefreshesRemoteDisconnect = async () => {
  const harness = await makeHarness(makeConnection())
  assert.equal(hasVisibleConnection(harness), true)
  const callsBeforeShow = harness.getStateCalls
  harness.connection = null
  harness.didShow()
  await harness.settle()
  assert.ok(harness.getStateCalls > callsBeforeShow, '页面重新显示时应重新读取搭子关系')
  assert.equal(hasVisibleConnection(harness), false, '对方已解除关系后重新显示页面应清除旧关系')
}

const testAccountSwitchUnmountsOldScope = async () => {
  const harness = await makeHarness(makeConnection())
  const oldPageHost = harness.contentHost
  const stale = await startStaleRead(harness)
  harness.switchAccount('account-2-scope', 2, null)
  await harness.settle()
  assert.notEqual(harness.contentHost, oldPageHost, '账号缓存范围变化应按 page key 重建页面实例')
  assert.equal(oldPageHost.unmounted, true, '旧账号页面应在新范围渲染前卸载')
  assert.equal(hasVisibleConnection(harness), false, '新账号不能继承旧账号的课表搭子关系')

  stale.response.resolve({ connection: stale.snapshot })
  await harness.drainMicrotasks()
  harness.render()
  assert.equal(hasVisibleConnection(harness), false, '旧账号迟到的关系响应不能覆盖新账号页面')
  assert.equal(oldPageHost.postUnmountStateUpdates, 0, '账号切换后旧页面不得再提交 React 状态')
}

const testLegacyFaultInjectionReproducesOldFailures = async () => {
  // 页面文件当前没有 Git 基线（feature 页面是 untracked）；此处仅在内存中移除新协调/刷新行为，不能当作旧版文件动态测试。
  const settingsHarness = await makeHarness(makeConnection('busy'), '', true)
  const settingsButton = settingsHarness.findByLabel('设置为课程详情')
  const update = deferred<void>()
  settingsHarness.nextUpdateSettings = update
  const callsBeforeMutation = settingsHarness.getStateCalls
  settingsButton?.props.onClick()
  await settingsHarness.waitFor(() => settingsHarness.updateSettingsCalls === 1, '故障注入中的设置 mutation 未启动')
  const delayedRead = deferred<{ connection: Connection | null }>()
  const snapshot = cloneConnection(settingsHarness.connection)
  settingsHarness.nextGetState = () => delayedRead.promise
  settingsHarness.pullDown()
  await settingsHarness.waitFor(() => settingsHarness.getStateCalls > callsBeforeMutation, '故障注入中 mutation 期间的下拉刷新未启动旧 GET')
  update.resolve()
  settingsHarness.nextUpdateSettings = null
  await settingsHarness.waitWithoutRender(() => settingsHarness.toastTitles.includes('分享设置已更新'), '故障注入中的设置 mutation 未完成')
  delayedRead.resolve({ connection: snapshot })
  await settingsHarness.drainMicrotasks()
  settingsHarness.render()
  assert.equal(settingsHarness.activeScope(), false, '故障注入中 mutation 先开始、下拉 GET 后到时，迟到旧 GET 应复现分享设置回退')

  const showHarness = await makeHarness(makeConnection(), '', true)
  const callsBeforeShow = showHarness.getStateCalls
  showHarness.connection = null
  showHarness.didShow()
  await showHarness.settle()
  assert.equal(showHarness.getStateCalls, callsBeforeShow, '移除 show 刷新后不应重新读取关系')
  assert.equal(hasVisibleConnection(showHarness), true, '移除 show 刷新后应复现对方解绑但页面仍显示关系')
}

const testCreateRevokeAndReadSerialization = async () => {
  const harness = await makeHarness(null)
  harness.findByLabel('课表 CP')?.props.onClick()
  harness.findByLabel('课程详情')?.props.onClick()
  await harness.settle()
  assert.equal(harness.activeRelation(), true)
  assert.equal(harness.activeScope(), true)
  const createButton = harness.findByLabel('生成课表搭子邀请')
  assert.ok(createButton)
  const create = deferred<{ token: string; expiresAt: string }>()
  harness.nextCreateInvitation = create
  const stateCallsBeforeCreate = harness.getStateCalls
  createButton?.props.onClick()
  createButton?.props.onClick()
  await harness.waitFor(() => harness.createInvitationCalls === 1, '生成邀请请求没有启动')
  assert.equal(harness.createInvitationCalls, 1, '同一邀请创建请求应防重复提交')
  harness.findByLabel('仅忙闲')?.props.onClick()
  harness.findByLabel('朋友')?.props.onClick()
  await harness.settle()
  assert.equal(harness.activeScope(), true, '邀请生成期间分享范围必须保持与请求一致')
  assert.equal(harness.activeRelation(), true, '邀请生成期间关系类型必须保持与请求一致')
  assert.deepEqual(harness.createInvitationInputs[0], {
    relationType: 'cp',
    shareScope: 'details',
    expiresInHours: 24,
  }, '邀请请求须使用点击生成时已选的关系和分享范围')
  harness.pullDown()
  await harness.waitFor(() => true, '生成邀请期间刷新未处理')
  assert.equal(harness.getStateCalls, stateCallsBeforeCreate, '创建邀请期间的刷新应等待 mutation 完成')
  create.resolve({ token: 'b'.repeat(64), expiresAt: 'later' })
  harness.nextCreateInvitation = null
  await harness.settle()
  assert.ok(harness.hasText('邀请已准备好'), '创建成功后显示待分享邀请')
  assert.ok(harness.hasText('邀请关系：课表 CP · 分享范围：课程详情'), '创建成功后邀请明细须与控件及请求保持一致')

  const revokeButton = harness.findClickableByText('更改关系或分享范围')
  assert.ok(revokeButton, '待分享邀请应显示撤销并修改入口')
  const revoke = deferred<void>()
  harness.nextRevokeInvitation = revoke
  const stateCallsBeforeRevoke = harness.getStateCalls
  revokeButton?.props.onClick()
  await harness.waitFor(() => harness.revokeInvitationCalls === 1, '撤销邀请请求没有启动')
  revokeButton?.props.onClick()
  harness.pullDown()
  await harness.waitFor(() => true, '撤销邀请期间刷新未处理')
  assert.equal(harness.revokeInvitationCalls, 1, '撤销进行中重复点击不得并发发起 mutation')
  assert.equal(harness.getStateCalls, stateCallsBeforeRevoke, '撤销邀请期间的刷新应等待 mutation 完成')
  revoke.reject(new Error('temporary revoke failure'))
  harness.nextRevokeInvitation = null
  await harness.settle()
  assert.ok(harness.hasText('邀请已准备好'), '撤销失败必须保留原邀请，不能提前解锁设置')

  const retryRevokeButton = harness.findClickableByText('更改关系或分享范围')
  retryRevokeButton?.props.onClick()
  await harness.settle()
  assert.equal(harness.revokeInvitationCalls, 2, '失败后应允许重试撤销')
  assert.equal(harness.hasText('邀请已准备好'), false, '撤销成功后才清除待分享邀请')
  assert.ok(harness.findByLabel('生成课表搭子邀请'), '撤销成功后邀请选项应重新开放')
}

const testFailedInvitationCreationUnlocksSelection = async () => {
  const harness = await makeHarness(null)
  const failure = deferred<{ token: string; expiresAt: string }>()
  harness.nextCreateInvitation = failure
  harness.findByLabel('生成课表搭子邀请')?.props.onClick()
  await harness.waitFor(() => harness.createInvitationCalls === 1, '失败场景下邀请请求没有启动')

  harness.findByLabel('课表 CP')?.props.onClick()
  harness.findByLabel('课程详情')?.props.onClick()
  await harness.settle()
  assert.equal(harness.activeRelation(), false, '请求进行中不能改变关系类型')
  assert.equal(harness.activeScope(), false, '请求进行中不能改变分享范围')

  failure.reject(new Error('temporary invite failure'))
  harness.nextCreateInvitation = null
  await harness.settle()
  assert.equal(harness.hasText('邀请已准备好'), false, '创建失败不能留下待分享邀请')

  harness.findByLabel('课表 CP')?.props.onClick()
  harness.findByLabel('课程详情')?.props.onClick()
  await harness.settle()
  assert.equal(harness.activeRelation(), true, '创建失败后关系选项应恢复编辑')
  assert.equal(harness.activeScope(), true, '创建失败后分享范围应恢复编辑')
}

const testAcceptedOutgoingInvitationStopsSharingOldToken = async () => {
  const harness = await makeHarness(null)
  harness.findByLabel('生成课表搭子邀请')?.props.onClick()
  await harness.settle()
  assert.equal(harness.shareMessage().query.token, 'b'.repeat(64), '待接受邀请可主动分享令牌')
  harness.connection = makeConnection()
  harness.didShow()
  await harness.settle()
  assert.equal(hasVisibleConnection(harness), true, '对方接受后权威状态应显示关系')
  assert.deepEqual(harness.shareMessage().query, {}, '关系已建立后不能继续分享已接受的旧邀请令牌')
}

const testFailedMutationAndCancelledDisconnectUnlock = async () => {
  const harness = await makeHarness(makeConnection('busy'))
  const scopeButton = harness.findByLabel('设置为课程详情')
  const disconnectButton = harness.findByLabel('解除课表搭子关系')
  assert.ok(scopeButton && disconnectButton)
  const failure = deferred<void>()
  harness.nextUpdateSettings = failure
  scopeButton?.props.onClick()
  await harness.waitFor(() => harness.updateSettingsCalls === 1, '设置 mutation 没有启动')
  disconnectButton?.props.onClick()
  await harness.drainMicrotasks()
  assert.equal(harness.disconnectCalls, 0, '设置 mutation 进行中不得并发解除关系')
  failure.reject(new Error('temporary settings failure'))
  harness.nextUpdateSettings = null
  await harness.settle()
  assert.equal(harness.activeScope(), false, '设置失败后保留服务端原分享范围')
  const retryScope = harness.findByLabel('设置为课程详情')
  retryScope?.props.onClick()
  await harness.settle()
  assert.equal(harness.activeScope(), true, '设置失败后应释放锁并允许重试')

  harness.modalConfirm = false
  harness.findByLabel('解除课表搭子关系')?.props.onClick()
  await harness.settle()
  assert.equal(harness.disconnectCalls, 0, '用户取消确认时不得调用解除接口')
  harness.modalConfirm = true
  harness.findByLabel('解除课表搭子关系')?.props.onClick()
  await harness.settle()
  assert.equal(harness.disconnectCalls, 1, '取消确认后应释放锁，允许再次确认解除')
  assert.equal(hasVisibleConnection(harness), false)
}

const testScheduleNotFoundRefreshesRelation = async () => {
  const harness = await makeHarness(makeConnection())
  const callsBeforeSchedule = harness.getScheduleCalls
  const callsBeforeState = harness.getStateCalls
  harness.connection = null
  harness.findByLabel('上传当前学期自定义课程并刷新双方课表')?.props.onClick()
  await harness.settle()
  assert.ok(harness.getScheduleCalls > callsBeforeSchedule, '必须发起实际的课表请求以触发 not-found')
  assert.ok(harness.getStateCalls > callsBeforeState, '关系失效的课表响应应刷新权威关系状态')
  assert.equal(hasVisibleConnection(harness), false, '服务端关系已不存在时应清除陈旧连接页')
}

const testUnmountBlocksLateReadAndHasNoChat = async () => {
  const harness = await makeHarness(makeConnection())
  assert.equal(harness.findByLabel('约饭并打开私信'), null, '搭子页不再提供约饭私信入口')
  assert.equal(harness.findByLabel('约自习并打开私信'), null, '搭子页不再提供自习私信入口')
  const staleRead = await startStaleRead(harness)
  const unmountedPageHost = harness.contentHost
  harness.unmount()
  staleRead.response.resolve({ connection: staleRead.snapshot })
  await harness.drainMicrotasks(20)
  assert.equal(harness.createConversationCalls, 0, '搭子页不得创建私信会话')
  assert.equal(unmountedPageHost.postUnmountStateUpdates, 0, '页面卸载后迟到的状态响应不得再写入 React 状态')
}

const run = async () => {
  await testLegacyFaultInjectionReproducesOldFailures()
  await testReadCompletedBeforeMutation()
  await testSettingsCannotBeRolledBackByOldRead()
  await testOldReadCompletesDuringMutation()
  await testDisconnectCannotBeRevertedByOldRead()
  await testAcceptStillCompletesAcrossRefresh()
  await testShowRefreshesRemoteDisconnect()
  await testAccountSwitchUnmountsOldScope()
  await testCreateRevokeAndReadSerialization()
  await testFailedInvitationCreationUnlocksSelection()
  await testAcceptedOutgoingInvitationStopsSharingOldToken()
  await testFailedMutationAndCancelledDisconnectUnlock()
  await testScheduleNotFoundRefreshesRelation()
  await testUnmountBlocksLateReadAndHasNoChat()
  console.log('timetable buddy page state smoke: ok (legacy fault injection reproduced; production page flows passed)')
}

void run().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
