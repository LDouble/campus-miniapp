import { strict as assert } from 'node:assert'
import {
  createPostExposureController,
  getPostExposureThreshold,
  isPostExposed,
  type ExposureClock,
} from '../src/features/community/exposure-utils'

let now = 0
let nextTimer = 0
const timers = new Map<number, { at: number; callback: () => void }>()
const clock: ExposureClock = {
  now: () => now,
  setTimeout: (callback, delay) => {
    const id = ++nextTimer
    timers.set(id, { at: now + delay, callback })
    return id as unknown as ReturnType<typeof setTimeout>
  },
  clearTimeout: (id) => timers.delete(id as unknown as number),
}
const advance = (milliseconds: number) => {
  now += milliseconds
  for (const [id, timer] of [...timers]) {
    if (timer.at <= now) {
      timers.delete(id)
      timer.callback()
    }
  }
}

void (async () => {
  assert.equal(getPostExposureThreshold(2_000, 600), 0.15)
  assert.equal(isPostExposed(
    { top: 0, bottom: 1_200, left: 0, right: 300, width: 300, height: 1_200 },
    { top: 0, bottom: 600 },
  ), true)
  assert.equal(isPostExposed(
    { top: 101, bottom: 301, left: 0, right: 300, width: 300, height: 200 },
    { top: 0, bottom: 200 },
  ), false)
  assert.equal(isPostExposed(
    { top: 0, bottom: 200, left: 250, right: 550, width: 300, height: 200 },
    { top: 0, bottom: 200, left: 0, right: 400 },
  ), true)
  assert.equal(isPostExposed(
    { top: 0, bottom: 200, left: 301, right: 601, width: 300, height: 200 },
    { top: 0, bottom: 200, left: 0, right: 400 },
  ), false)

  let reports = 0
  let recheck = true
  const controller = createPostExposureController({
    clock,
    recheck: () => recheck,
    onExposure: () => { reports += 1 },
  })
  controller.updateVisible(true)
  advance(999)
  assert.equal(reports, 0)
  advance(1)
  await Promise.resolve()
  assert.equal(reports, 1)
  controller.updateVisible(true)
  advance(1_000)
  assert.equal(reports, 1, 'continuous exposure must only report once')
  controller.updateVisible(false)
  controller.updateVisible(true)
  recheck = false
  advance(1_000)
  await Promise.resolve()
  assert.equal(reports, 1, 'expiration must recheck visibility')
  let resolveRecheck: ((visible: boolean) => void) | undefined
  const racingController = createPostExposureController({
    clock,
    recheck: () => new Promise<boolean>((resolve) => { resolveRecheck = resolve }),
    onExposure: () => { reports += 1 },
  })
  racingController.updateVisible(true)
  advance(1_000)
  racingController.updateVisible(false)
  racingController.updateVisible(true)
  resolveRecheck?.(false)
  await Promise.resolve()
  advance(1_000)
  resolveRecheck?.(true)
  await Promise.resolve()
  assert.equal(reports, 2, 'stale recheck must not cancel the new exposure')
  controller.hide()
  controller.show()
  controller.updateVisible(true)
  controller.dispose()
  advance(1_000)
  assert.equal(reports, 2, 'hide/dispose must clear outstanding timers')
  process.stdout.write('community post exposure smoke: ok\n')
})()
