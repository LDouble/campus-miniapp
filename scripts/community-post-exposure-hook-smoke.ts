import { strict as assert } from 'node:assert'
import Module = require('node:module')

// 用受控的原生桥接回调和时钟验证 Hook 的生命周期竞态，无需连接真实 API。
let now = 0
let nextTimer = 0
const timers = new Map<number, { at: number; callback: () => void }>()
const refs: Array<{ current: unknown }> = []
const effects: Array<{ run: () => void | (() => void); deps: unknown[]; cleanup?: () => void }> = []
let refIndex = 0
let effectIndex = 0
let pendingEffects: Array<() => void> = []
let hide = () => undefined
let show = () => undefined
let resize = () => undefined
const ticks: Array<() => void> = []
const queries: Array<() => void> = []
const page = {}
let currentPage: object | null = page
let card = { top: 100, bottom: 300, left: 0, right: 300, width: 300, height: 200 }
const observers: Array<{ disconnected: boolean; callback?: (result: unknown) => void }> = []
const taro = {
  getCurrentInstance: () => ({ page: currentPage }),
  getWindowInfo: () => ({ windowHeight: 600, windowWidth: 375 }),
  useDidHide: (callback: typeof hide) => { hide = callback },
  useDidShow: (callback: typeof show) => { show = callback },
  nextTick: (callback: () => void) => ticks.push(callback),
  onWindowResize: (callback: typeof resize) => { resize = callback },
  offWindowResize: () => { resize = () => undefined },
  createSelectorQuery: () => {
    const query = {
      in: (scope: unknown) => { assert.equal(scope, page); return query },
      select: () => query,
      boundingClientRect: () => query,
      exec: (callback: (result: unknown[]) => void) => queries.push(() => callback([{ ...card }])),
    }
    return query
  },
  createIntersectionObserver: (scope: unknown) => {
    assert.equal(scope, page)
    const state = { disconnected: false, callback: undefined as undefined | ((result: unknown) => void) }
    observers.push(state)
    const observer = {
      relativeToViewport: () => observer,
      observe: (_selector: string, callback: (result: unknown) => void) => { state.callback = callback },
      disconnect: () => { state.disconnected = true },
    }
    return observer
  },
}
const react = {
  useRef: (initial: unknown) => {
    const index = refIndex++
    return refs[index] || (refs[index] = { current: initial })
  },
  useEffect: (run: () => void | (() => void), deps: unknown[]) => {
    const index = effectIndex++
    const previous = effects[index]
    if (previous && deps.every((dep, i) => Object.is(dep, previous.deps[i]))) return
    pendingEffects.push(() => {
      previous?.cleanup?.()
      effects[index] = { run, deps, cleanup: run() || undefined }
    })
  },
}
const loader = Module as unknown as { _load: (...args: unknown[]) => unknown }
const originalLoad = loader._load
loader._load = function (name, ...args) {
  if (name === 'react') return react
  if (name === '@tarojs/taro') return { ...taro, default: taro }
  return originalLoad.call(this, name, ...args)
}
const { usePostExposure } = require('../src/features/community/use-post-exposure') as typeof import('../src/features/community/use-post-exposure')
loader._load = originalLoad

const originalNow = Date.now
const originalSetTimeout = global.setTimeout
const originalClearTimeout = global.clearTimeout
Date.now = () => now
global.setTimeout = ((callback: () => void, delay: number) => {
  const id = ++nextTimer
  timers.set(id, { at: now + delay, callback })
  return id
}) as unknown as typeof setTimeout
global.clearTimeout = ((id: number) => timers.delete(id)) as unknown as typeof clearTimeout
const flushPromises = async () => { for (let i = 0; i < 6; i++) await Promise.resolve() }
const flushBridge = async () => {
  ticks.splice(0).forEach((callback) => callback())
  queries.splice(0).forEach((callback) => callback())
  await flushPromises()
}
const advance = async (duration: number) => {
  now += duration
  for (const [id, timer] of [...timers]) {
    if (timer.at > now) continue
    timers.delete(id)
    timer.callback()
  }
  await flushBridge()
}
let reports = 0
const render = (enabled: boolean) => {
  refIndex = 0
  effectIndex = 0
  usePostExposure({ selector: '#post-1', enabled, onExposure: () => { reports++ } })
  pendingEffects.splice(0).forEach((run) => run())
}

void (async () => {
  try {
    render(true)
    await flushBridge()
    assert.equal(observers.length, 1, 'mount must not leak a second observer')
    observers[0].callback?.({ boundingClientRect: {}, intersectionRatio: 1 })
    await advance(999)
    assert.equal(reports, 0)
    hide()
    await advance(1)
    assert.equal(reports, 0, 'hiding just before the deadline must cancel the read')
    show()
    await flushBridge()
    observers[observers.length - 1].callback?.({ boundingClientRect: {}, intersectionRatio: 1 })
    await advance(1_000)
    assert.equal(reports, 1, 'native empty bounding rect must not cancel a visible exposure')
    resize()
    await flushBridge()
    await advance(900)
    resize()
    await flushBridge()
    await advance(100)
    assert.equal(reports, 1, 'resize must restart the full dwell period')
    await advance(900)
    assert.equal(reports, 2)

    show()
    ticks.splice(0).forEach((callback) => callback())
    const beforeHide = observers.length
    hide()
    await flushBridge()
    assert.equal(observers.length, beforeHide, 'late layout query must not observe a hidden page')
    render(false)
    show()
    await flushBridge()
    await advance(2_000)
    assert.equal(reports, 2, 'inactive list must not count')
    render(true)
    await flushBridge()
    const lastObserver = observers[observers.length - 1]
    card = { ...card, top: 590, bottom: 790 }
    lastObserver.callback?.({ boundingClientRect: {}, intersectionRatio: 0.05 })
    await advance(1_000)
    assert.equal(reports, 2, 'quickly scrolled-out card must not count')
    effects.forEach((effect) => effect.cleanup?.())
    lastObserver.callback?.({ boundingClientRect: { ...card, top: 100, bottom: 300 } })
    await advance(1_000)
    assert.equal(reports, 2)
    assert.ok(observers.every((observer) => observer.disconnected), 'unmount must disconnect every observer')
    // 后台加载完成时没有 Current.page，回到前台应能恢复绑定。
    refs.length = 0
    effects.length = 0
    currentPage = null
    card = { ...card, top: 100, bottom: 300 }
    render(false)
    await flushBridge()
    currentPage = page
    render(true)
    show()
    await flushBridge()
    observers[observers.length - 1].callback?.({ boundingClientRect: {}, intersectionRatio: 1 })
    await advance(1_000)
    assert.equal(reports, 3, 'background-loaded card must bind its page after returning')
    effects.forEach((effect) => effect.cleanup?.())
    process.stdout.write('community post exposure hook smoke: ok\n')
  } finally {
    Date.now = originalNow
    global.setTimeout = originalSetTimeout
    global.clearTimeout = originalClearTimeout
  }
})().catch((error) => { console.error(error); process.exitCode = 1 })
