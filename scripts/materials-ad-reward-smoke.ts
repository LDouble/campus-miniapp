import { strict as assert } from 'node:assert'
import { createAdRewardController, type AdRewardPhase } from '../src/features/course-materials/ad-reward-controller'

async function run() {
  let phase: AdRewardPhase = 'idle'
  let scope = 'user-a'
  let now = 1000
  let creates = 0
  let claims = 0
  let successes = 0
  const keys: string[] = []
  const errors: string[] = []
  let fail = false
  let release: (() => void) | undefined
  let pendingCreate = false
  const controller = createAdRewardController({
    create: async () => {
      creates += 1
      if (pendingCreate) await new Promise<void>((resolve) => { release = resolve })
      return { id: 1, session_token: 'test-token', expires_at: new Date(10000).toISOString() }
    },
    claim: async (_session, key) => {
      claims += 1
      keys.push(key)
      await Promise.resolve()
      if (fail) throw new Error('network failure')
      return { remaining: 11 }
    },
    createKey: () => 'stable-key',
    scope: () => scope,
    now: () => now,
    change: (next) => { phase = next },
    success: (quota) => { assert.equal(quota.remaining, 11); successes += 1 },
    error: (message) => errors.push(message),
  })
  await Promise.all([controller.open(), controller.open()])
  assert.equal(creates, 1)
  assert.equal(phase, 'preparing')
  await controller.tap()
  assert.equal(claims, 0, '未加载可见广告不能领奖')
  controller.ready()
  fail = true
  await Promise.all([controller.tap(), controller.tap()])
  assert.equal(claims, 1, '连续点击只发送一次')
  assert.equal(phase, 'visible')
  fail = false
  await controller.tap()
  assert.equal(successes, 1)
  assert.equal(keys[0], keys[1], '失败重试复用幂等键')
  assert.equal(phase, 'idle')
  await controller.open()
  controller.ready()
  now = 11000
  await controller.tap()
  assert.equal(claims, 2, '过期会话不发领奖请求')
  assert.equal(phase, 'idle')
  now = 1000
  pendingCreate = true
  const opening = controller.open()
  controller.close()
  release?.()
  await opening
  assert.equal(phase, 'idle', '离页后迟到响应不能重新弹出')
  pendingCreate = false
  await controller.open()
  controller.ready()
  scope = 'user-b'
  await controller.tap()
  assert.equal(claims, 2, '切换账号不得使用旧会话')
  scope = 'user-a'
  await controller.open()
  controller.ready()
  const claiming = controller.tap()
  controller.close()
  await claiming
  assert.equal(successes, 1, '关闭后的迟到响应不修改当前页面')
  assert.ok(errors.length >= 2)
  await controller.open()
  controller.ready()
  const beforeResume = claims
  await controller.foreground()
  assert.equal(claims, beforeResume, '未进入后台不能领取')
  controller.background()
  await controller.foreground()
  assert.equal(claims, beforeResume, '未实际展示不能领取')
  controller.presented()
  controller.background()
  await Promise.all([controller.foreground(), controller.foreground(), controller.tap()])
  assert.equal(claims, beforeResume + 1, '广告展示后恢复和点击共用一次领取')
  await controller.open()
  controller.ready()
  controller.presented()
  controller.background()
  controller.close()
  await controller.foreground()
  assert.equal(claims, beforeResume + 1, '主动关闭后恢复不奖励')
  console.log('materials local ad reward smoke: ok')
}
void run().catch((error) => { console.error(error); process.exitCode = 1 })
