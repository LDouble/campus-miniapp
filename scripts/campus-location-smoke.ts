import { strict as assert } from 'node:assert'
import { createCampusLocationPrompt } from '../src/features/campus-location/controller'
import { identifyCampus, LAOSHAN_CAMPUS, WEST_COAST_CAMPUS, type CampusLocation } from '../src/features/campus-location/location'

const west = { latitude: 35.775004, longitude: 120.030367, accuracy: 20 }
const laoshan = { latitude: 36.161293, longitude: 120.499037, accuracy: 20 }
const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

async function main() {
  assert.equal(identifyCampus(west), WEST_COAST_CAMPUS)
  assert.equal(identifyCampus(laoshan), LAOSHAN_CAMPUS)
  assert.equal(identifyCampus({ ...west, latitude: 36.07, longitude: 120.32 }), null, '市区不能按最近校区误判')
  for (const location of [
    { ...west, accuracy: 201 }, { ...west, accuracy: 0 }, { ...west, accuracy: -1 },
    { ...west, accuracy: NaN }, { ...west, horizontalAccuracy: 500 },
    { ...west, latitude: Infinity }, { ...west, longitude: 181 },
  ]) assert.equal(identifyCampus(location), null, '无效坐标或精度不足不识别')
  const north = (meters: number) => ({ ...west, latitude: west.latitude + meters / 6371000 * 180 / Math.PI })
  assert.equal(identifyCampus(north(9970)), WEST_COAST_CAMPUS, '精度圆完整落入范围')
  assert.equal(identifyCampus(north(9990)), null, '精度圆跨越范围边缘不识别')
  assert.equal(identifyCampus(north(10100)), null)

  const values = new Map<string, unknown>()
  const mocks: Record<string, unknown> = {
    '@tarojs/taro': { default: {
      getStorageSync: (key: string) => values.get(key),
      setStorageSync: (key: string, value: unknown) => values.set(key, value),
    } },
    '../src/api/client': {},
    '../src/features/wechat-subscription/request': {},
    '../src/utils/navigation': {},
  }
  for (const [id, exports] of Object.entries(mocks)) {
    require.cache[require.resolve(id)] = { exports } as NodeModule
  }
  const runtime: typeof import('../src/features/runtime-config') = require('../src/features/runtime-config')
  const config = runtime.DEFAULT_MINIAPP_RUNTIME_CONFIG
  let active = true
  let available = true
  let reads = 0
  let prompts = 0
  let switches = 0
  const context = {
    isEligible: () => active && available && runtime.getSelectedCampus(config) === LAOSHAN_CAMPUS,
    switchCampus: () => { runtime.saveSelectedCampus(WEST_COAST_CAMPUS); switches += 1 },
  }
  const setup = (location: () => Promise<CampusLocation> = async () => west, confirmation = async () => true) => (
    createCampusLocationPrompt({
      getLocation: () => { reads += 1; return location() },
      confirmSwitch: () => { prompts += 1; return confirmation() },
      locationTimeoutMs: 10,
    })
  )
  assert.equal(runtime.getSectionStartTime(config, runtime.getSelectedCampus(config), 1), '08:00')
  const accept = setup()
  await accept.run(context)
  assert.equal(switches, 1)
  assert.equal(runtime.getSelectedCampus(config), WEST_COAST_CAMPUS, '确认结果必须持久化')
  assert.equal(runtime.getSectionStartTime(config, runtime.getSelectedCampus(config), 1), '08:30', '作息使用同一校区')
  await accept.run(context)
  assert.equal(reads, 1, '同次运行重复进入不重复定位')

  runtime.saveSelectedCampus(LAOSHAN_CAMPUS)
  const cancel = setup(undefined, async () => false)
  const beforeCancel = new Map(values)
  await cancel.run(context)
  await cancel.run(context)
  assert.deepEqual(values, beforeCancel, '取消不改配置')
  assert.equal(prompts, 2, '取消后不再提示')

  for (const campus of [WEST_COAST_CAMPUS, '鱼山校区']) {
    runtime.saveSelectedCampus(campus)
    const before = reads
    await setup().run(context)
    assert.equal(reads, before, '非崂山校区不请求定位')
  }
  runtime.saveSelectedCampus(LAOSHAN_CAMPUS)
  const beforeDisabled = reads
  available = false
  await setup().run(context)
  available = true
  active = false
  await setup().run(context)
  active = true
  assert.equal(reads, beforeDisabled, '目标停用或页面不可见不定位')

  const beforeIgnored = prompts
  for (const location of [laoshan, { ...west, accuracy: 1000 }, { ...west, latitude: 0 }]) {
    await setup(async () => location).run(context)
  }
  await setup(async () => { throw new Error('auth deny') }).run(context)
  assert.equal(prompts, beforeIgnored, '未知位置或授权失败无提示')

  const pendingLocation = deferred<CampusLocation>()
  const concurrent = setup(() => pendingLocation.promise)
  const first = concurrent.run(context)
  await concurrent.run(context)
  pendingLocation.resolve(west)
  await first
  assert.equal(prompts, beforeIgnored + 1, '并发进入只弹一次')
  runtime.saveSelectedCampus(LAOSHAN_CAMPUS)

  for (const invalidate of ['leave', 'manual', 'disabled'] as const) {
    const pending = deferred<CampusLocation>()
    const controller = setup(() => pending.promise)
    const before = prompts
    const run = controller.run(context)
    if (invalidate === 'leave') controller.cancelPending()
    if (invalidate === 'manual') controller.dismissForSession()
    if (invalidate === 'disabled') available = false
    pending.resolve(west)
    await run
    available = true
    assert.equal(prompts, before, '异步结果失效后不弹窗')
  }

  const shown = deferred<void>()
  const answer = deferred<boolean>()
  const interrupted = setup(undefined, () => { shown.resolve(); return answer.promise })
  const beforeInterrupted = switches
  const running = interrupted.run(context)
  await shown.promise
  interrupted.cancelPending()
  answer.resolve(true)
  await running
  assert.equal(switches, beforeInterrupted, '离开再返回也不能应用旧弹窗确认')
  assert.equal(runtime.getSelectedCampus(config), LAOSHAN_CAMPUS)

  for (const change of ['campus', 'availability'] as const) {
    const modalShown = deferred<void>()
    const modalAnswer = deferred<boolean>()
    const controller = setup(undefined, () => { modalShown.resolve(); return modalAnswer.promise })
    const before = switches
    const run = controller.run(context)
    await modalShown.promise
    if (change === 'campus') runtime.saveSelectedCampus('鱼山校区')
    else available = false
    modalAnswer.resolve(true)
    await run
    assert.equal(switches, before, '确认时必须重新核对当前选择和校区启用状态')
    available = true
    runtime.saveSelectedCampus(LAOSHAN_CAMPUS)
  }

  const timedOutLocation = deferred<CampusLocation>()
  const timeout = setup(() => timedOutLocation.promise)
  const beforeTimeout = prompts
  await timeout.run(context)
  timedOutLocation.resolve(west)
  await Promise.resolve()
  await timeout.run(context)
  assert.equal(prompts, beforeTimeout, '超时后的定位结果不能弹窗或重试')
  await setup(undefined, async () => { throw new Error('modal fail') }).run(context)
  assert.equal(runtime.getSelectedCampus(config), LAOSHAN_CAMPUS, '弹窗失败不修改选择')
  console.log('campus location smoke: ok')
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
