import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

;(global as Record<string, unknown>).__CAMPUS_TARGET_WECHAT_APP_ID__ = 'wxactivitypopup'
;(global as Record<string, unknown>).__CAMPUS_TARGET_MINIAPP_ENV_VERSION__ = 'release'

const taro = require('@tarojs/taro').default as {
  getImageInfo: (options: { src: string }) => Promise<unknown>
  navigateTo: (options: { url: string }) => Promise<unknown>
  navigateToMiniProgram: (options: { appId: string; path: string }) => Promise<unknown>
}
const {
  ACTIVITY_POPUP_IDLE_MS,
  isActivityPopupCandidateValid,
  isActivityPopupClaimUsable,
  preloadActivityPopupImage,
  shouldReportActivityPopupClose,
} = require('../src/features/activity-popup/policy') as typeof import('../src/features/activity-popup/policy')
const {
  isActivityPopupActionSupported,
  openActivityPopupAction,
} = require('../src/features/activity-popup/navigation') as typeof import('../src/features/activity-popup/navigation')
const {
  ACTIVITY_POPUP_CUSTOM_MINI_PROGRAM_APP_ID,
  ACTIVITY_POPUP_MINI_PROGRAM_PATH_MAX_LENGTH,
  activityPopupMiniProgramAppIds,
} = require('../src/features/activity-popup/mini-program-targets') as typeof import('../src/features/activity-popup/mini-program-targets')

const candidate = {
  id: 12,
  image_url: 'https://cdn.example.com/activity.png',
  action: { type: 'internal_page' as const, target_key: 'official_notice', params: { id: '7', unsafe: 'drop' } },
}

assert.equal(ACTIVITY_POPUP_IDLE_MS, 1000, '活动弹框必须在至少一秒无操作后才尝试')
assert.equal(isActivityPopupCandidateValid(candidate), true)
assert.equal(isActivityPopupCandidateValid({ ...candidate, image_url: 'http://unsafe.example.com/a.png' }), false)
assert.equal(isActivityPopupCandidateValid({ ...candidate, id: 0 }), false)
assert.equal(isActivityPopupClaimUsable({ display_id: 'display-1', lease_expires_at: '2030-01-01T00:00:00Z' }, Date.parse('2029-01-01T00:00:00Z')), true)
assert.equal(isActivityPopupClaimUsable({ display_id: 'display-1', lease_expires_at: '2029-01-01T00:00:00Z' }, Date.parse('2029-01-01T00:00:00Z')), false)
assert.equal(shouldReportActivityPopupClose(false, false), false, '图片未呈现时不能以 close 消耗展示次数')
assert.equal(shouldReportActivityPopupClose(true, false), false, '确认失败时不能以 close 反向确认展示')
assert.equal(shouldReportActivityPopupClose(true, true), true, '用户关闭已确认展示时应记录 close')

const main = async () => {
let preloaded = ''
taro.getImageInfo = async ({ src }) => { preloaded = src; return {} }
await preloadActivityPopupImage(candidate.image_url)
  assert.equal(preloaded, candidate.image_url, 'claim 前必须先完成图片预加载')

let internalUrl = ''
taro.navigateTo = async ({ url }) => { internalUrl = url; return {} }
{
  const opened = await openActivityPopupAction(candidate.action)
  assert.equal(opened, true)
  assert.equal(internalUrl, '/pages/official-notices/detail?id=7', '端内目标只能带白名单参数')
}

let externalTarget: { appId: string; path: string } | null = null
taro.navigateToMiniProgram = async ({ appId, path }) => { externalTarget = { appId, path }; return {} }
const externalAction = { type: 'mini_program' as const, target_key: 'full_miniapp', params: { path: 'pages/index/index' } }
assert.equal(isActivityPopupActionSupported(externalAction), true)
{
  const opened = await openActivityPopupAction(externalAction)
  assert.equal(opened, true)
  assert.deepEqual(externalTarget, { appId: 'wxactivitypopup', path: 'pages/index/index' })
}
assert.equal(isActivityPopupActionSupported({ ...externalAction, target_key: 'arbitrary_app_id' }), false)

// 覆盖用户提供的滴滴落地参数量级，但不把其中的会话追踪值提交到仓库。
const customPath = `/pages/index/webview?url=https%3A%2F%2Fprod.didi.cn%2Flanding%3Fpayload%3D${'x'.repeat(1400)}`
assert.ok(customPath.length > 1024 && customPath.length <= ACTIVITY_POPUP_MINI_PROGRAM_PATH_MAX_LENGTH, '脱敏长 path 必须覆盖验收样例量级且不超过新上限')
const customAction = {
  type: 'mini_program' as const,
  target_key: 'custom_miniapp',
  params: { app_id: ACTIVITY_POPUP_CUSTOM_MINI_PROGRAM_APP_ID, path: customPath },
}
assert.equal(isActivityPopupActionSupported(customAction), true, '登记的自定义小程序才能作为活动目标')
{
  const opened = await openActivityPopupAction(customAction)
  assert.equal(opened, true)
  assert.deepEqual(externalTarget, {
    appId: ACTIVITY_POPUP_CUSTOM_MINI_PROGRAM_APP_ID,
    path: customPath,
  }, '长 path 必须按原文传给目标小程序')
}
const unsupportedAppIdAction = {
  ...customAction,
  params: { ...customAction.params, app_id: 'wxnotregistered' },
}
assert.equal(isActivityPopupActionSupported(unsupportedAppIdAction), false, '未登记 AppID 必须在展示前被拒绝')
assert.equal(await openActivityPopupAction(unsupportedAppIdAction), false, '未登记 AppID 不能调用跳转 API')
assert.equal(isActivityPopupActionSupported({
  ...customAction,
  params: { app_id: ACTIVITY_POPUP_CUSTOM_MINI_PROGRAM_APP_ID },
}), false, 'custom_miniapp 缺少必填 path 时不能跳目标首页')
assert.equal(isActivityPopupActionSupported({
  ...customAction,
  params: { app_id: ACTIVITY_POPUP_CUSTOM_MINI_PROGRAM_APP_ID, path: '' },
}), false, 'custom_miniapp 空 path 时不能跳目标首页')
for (const unsafePath of [
  'pages/index',
  '//pages/index',
  '/pages/../index',
  '/pages/index\nnext',
  '/pages/index\rnext',
  '/pages/index\tnext',
]) {
  assert.equal(isActivityPopupActionSupported({
    ...customAction,
    params: { ...customAction.params, path: unsafePath },
  }), false, `custom_miniapp 必须拒绝不安全 path：${JSON.stringify(unsafePath)}`)
}
assert.equal(await openActivityPopupAction({
  ...customAction,
  params: { ...customAction.params, path: '/pages/../index' },
}), false, '不安全 path 不能调用跳转 API')
const overlongPathAction = {
  ...customAction,
  params: { ...customAction.params, path: 'x'.repeat(ACTIVITY_POPUP_MINI_PROGRAM_PATH_MAX_LENGTH + 1) },
}
assert.equal(isActivityPopupActionSupported(overlongPathAction), false, '超过 2048 字符的 path 必须显式拒绝')
assert.equal(await openActivityPopupAction(overlongPathAction), false, '超过 2048 字符的 path 不能静默跳到首页')
assert.equal(isActivityPopupActionSupported({
  ...customAction,
  params: { ...customAction.params, path: `/${'😀'.repeat(ACTIVITY_POPUP_MINI_PROGRAM_PATH_MAX_LENGTH - 1)}` },
}), true, '路径上限必须按 Unicode code point 计数，与后端 Go rune 对齐')
assert.equal(isActivityPopupActionSupported({
  ...customAction,
  params: { ...customAction.params, path: `/${'😀'.repeat(ACTIVITY_POPUP_MINI_PROGRAM_PATH_MAX_LENGTH)}` },
}), false, '超过 2048 个 Unicode code point 的 path 必须被拒绝')
assert.deepEqual(
  activityPopupMiniProgramAppIds().sort(),
  [ACTIVITY_POPUP_CUSTOM_MINI_PROGRAM_APP_ID, 'wxactivitypopup'].sort(),
  '运行时目标 AppID 与 app.config 静态名单必须来自同一注册表并去重',
)

const page = readFileSync(resolve(__dirname, '../src/pages/index/index.tsx'), 'utf8')
const preloadAt = page.indexOf('await preloadActivityPopupImage(candidate.image_url)')
const claimAt = page.indexOf('await claimActivityPopup(candidate.id)')
assert.ok(preloadAt >= 0 && claimAt > preloadAt, '图片预加载必须在预占展示资格前完成')
assert.ok(page.includes('onTouchStart={markActivityPopupInteraction}'), '用户开始操作后必须取消本次弹框机会')
assert.ok(page.includes('useDidHide(() => {'), '离开首页后不得补弹')
assert.ok(page.includes('showNotificationGuide'), '活动弹框必须等待通知引导结束')
assert.ok(page.includes('campusLocationPromptPending'), '活动弹框必须等待校区定位引导结束')
assert.ok(page.includes('setCustomTabBarHidden(true)'), '展示活动时必须隐藏 TabBar')
assert.ok(page.includes('onImageError={handleActivityPopupImageError}'), '图片渲染失败不能留下空弹框')
assert.ok(page.includes('activityPopupClickedRef.current'), '图片和按钮共用点击入口时必须阻止重复跳转')
assert.ok(page.includes('activityPopupPresentedRef.current'), '关闭事件必须区分图片是否真正呈现')
assert.ok(page.includes('activityPopupServerConfirmedRef.current'), '关闭事件必须等待服务端确认展示')
assert.doesNotMatch(page, /isActivityPopupClaimUsable\(claim\)\) void closeActivityPopupDisplay/u, '过晚的预占不能用 close 释放')
assert.match(page, /shouldReportActivityPopupClose\([\s\S]*?void closeActivityPopupDisplay\(current\.displayId\)/u, 'close 只能在图片呈现且服务端确认后上报')

const appConfig = readFileSync(resolve(__dirname, '../src/app.config.ts'), 'utf8')
assert.ok(appConfig.includes('navigateToMiniProgramAppIdList'), '外部目标必须进入小程序静态声明名单')
assert.ok(appConfig.includes('activityPopupMiniProgramAppIds'), '外部跳转名单必须复用运行时注册表')

console.log('activity popup smoke: ok')
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
