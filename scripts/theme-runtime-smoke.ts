import { strict as assert } from 'node:assert'

type Theme = 'light' | 'dark'
let hostTheme: Theme = 'light'
let failAppBaseInfo = false
let failSystemInfo = false
let invalidAppBaseInfo = false
let invalidSystemInfo = false
let registeredThemeListeners = 0
let onThemeChange: ((event: { theme: Theme }) => void) | undefined
let storageCalls = 0

const taro = {
  getAppBaseInfo() {
    if (failAppBaseInfo) throw new Error('AppBaseInfo unavailable')
    return invalidAppBaseInfo ? { theme: 'unsupported' } : { theme: hostTheme }
  },
  getSystemInfoSync() {
    if (failSystemInfo) throw new Error('SystemInfo unavailable')
    return invalidSystemInfo ? { theme: 'unsupported' } : { theme: hostTheme }
  },
  onThemeChange(listener: (event: { theme: Theme }) => void) {
    registeredThemeListeners += 1
    onThemeChange = listener
  },
  // 如果旧偏好实现被误引入，测试必须失败。
  getStorageSync() { storageCalls += 1; throw new Error('system theme must not read storage') },
  setStorageSync() { storageCalls += 1; throw new Error('system theme must not write storage') },
}

const taroModuleId = require.resolve('@tarojs/taro')
const originalTaroModule = require.cache[taroModuleId]
const systemThemeModuleId = require.resolve('../src/features/system-theme')
require.cache[taroModuleId] = {
  id: taroModuleId, filename: taroModuleId, loaded: true,
  exports: { __esModule: true, default: taro }, children: [], paths: [],
} as NodeModule

const reset = () => {
  hostTheme = 'light'
  failAppBaseInfo = false
  failSystemInfo = false
  invalidAppBaseInfo = false
  invalidSystemInfo = false
  registeredThemeListeners = 0
  onThemeChange = undefined
  storageCalls = 0
  delete require.cache[systemThemeModuleId]
}
const load = () => require(systemThemeModuleId) as typeof import('../src/features/system-theme')

try {
  reset()
  hostTheme = 'dark'
  const runtime = load()
  assert.equal(runtime.getCampusTheme(), 'dark', '系统深色必须直接决定应用主题，旧用户偏好不可参与')
  assert.equal(storageCalls, 0, '读取系统主题不得访问旧偏好存储')

  runtime.initializeCampusTheme()
  runtime.initializeCampusTheme()
  assert.equal(registeredThemeListeners, 1, '重复初始化只能注册一次系统主题监听')
  const events: Theme[] = []
  const unsubscribe = runtime.subscribeCampusTheme((theme) => events.push(theme))
  hostTheme = 'light'
  onThemeChange?.({ theme: 'light' })
  assert.equal(runtime.getCampusTheme(), 'light', '系统主题事件必须发布并刷新缓存')
  assert.deepEqual(events, ['dark', 'light'], '订阅建立时应获得当前系统快照，并收到后续变化')
  onThemeChange?.({ theme: 'light' })
  assert.deepEqual(events, ['dark', 'light'], '重复系统主题事件不得重复发布')

  hostTheme = 'dark'
  runtime.refreshCampusTheme()
  assert.equal(runtime.getCampusTheme(), 'dark', '前台恢复时必须重新读取宿主主题')
  assert.deepEqual(events, ['dark', 'light', 'dark'])
  runtime.refreshCampusTheme()
  assert.deepEqual(events, ['dark', 'light', 'dark'], '前台读取到相同主题时不得重复发布')
  unsubscribe()
  hostTheme = 'light'
  onThemeChange?.({ theme: 'light' })
  assert.deepEqual(events, ['dark', 'light', 'dark'], '取消订阅后不得继续收到系统主题事件')
  assert.equal(storageCalls, 0, '完整生命周期不得读写旧主题偏好')

  reset()
  hostTheme = 'dark'
  failAppBaseInfo = true
  let fallbackRuntime = load()
  assert.equal(fallbackRuntime.getCampusTheme(), 'dark', 'AppBaseInfo 失败时必须回退 SystemInfo')

  reset()
  hostTheme = 'dark'
  failAppBaseInfo = true
  failSystemInfo = true
  fallbackRuntime = load()
  assert.equal(fallbackRuntime.getCampusTheme(), 'light', '两个宿主 API 都失败时应安全回退浅色')
  failAppBaseInfo = false
  failSystemInfo = false
  assert.equal(fallbackRuntime.refreshCampusTheme(), 'dark', '失败回退不得永久缓存，宿主恢复后必须读回深色')

  reset()
  hostTheme = 'dark'
  invalidAppBaseInfo = true
  invalidSystemInfo = true
  fallbackRuntime = load()
  assert.equal(fallbackRuntime.getCampusTheme(), 'light', '无效宿主主题值必须安全回退浅色')
  assert.equal(storageCalls, 0, '读取失败与回退路径也不得访问旧偏好')
  console.log('system theme runtime smoke: ok')
} finally {
  if (originalTaroModule) require.cache[taroModuleId] = originalTaroModule
  else delete require.cache[taroModuleId]
  delete require.cache[systemThemeModuleId]
}
