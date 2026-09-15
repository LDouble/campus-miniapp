import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  HOME_NOTIFICATION_GUIDE_COOLDOWN_MS,
  resolveHomeNotificationTemplateIds,
  shouldShowHomeNotificationGuide,
} from '../src/features/home/notification-guide-policy'

const templateIds = resolveHomeNotificationTemplateIds({
  community: ['community-template', 'community-template'],
  private_message: ['private-template'],
})
const now = 1_800_000_000_000

assert.deepEqual(templateIds, ['community-template', 'private-template'])
assert.equal(shouldShowHomeNotificationGuide({ userId: 8, unreadCount: 2, templateIds, record: null, now }), true)
assert.equal(shouldShowHomeNotificationGuide({ userId: 8, unreadCount: 0, templateIds, record: null, now }), false)
assert.equal(shouldShowHomeNotificationGuide({ userId: 8, unreadCount: 2, templateIds: [], record: null, now }), false)
assert.equal(shouldShowHomeNotificationGuide({
  userId: 8,
  unreadCount: 2,
  templateIds,
  record: { lastShownAt: now - HOME_NOTIFICATION_GUIDE_COOLDOWN_MS + 1 },
  now,
}), false)
assert.equal(shouldShowHomeNotificationGuide({
  userId: 8,
  unreadCount: 2,
  templateIds,
  record: { lastShownAt: now - HOME_NOTIFICATION_GUIDE_COOLDOWN_MS },
  now,
}), true)

const homePage = readFileSync(resolve(__dirname, '../src/pages/index/index.tsx'), 'utf8')
const styles = readFileSync(resolve(__dirname, '../src/pages/index/index.scss'), 'utf8')
const subscription = readFileSync(resolve(__dirname, '../src/features/wechat-subscription/request.ts'), 'utf8')

assert.ok(homePage.includes('refreshPrivateMessageUnreadCount(true)'), '首页必须聚合刷新私信未读数')
assert.ok(homePage.includes('noticesRepository.unreadCount()'), '首页必须刷新校园通知未读数')
assert.ok(homePage.includes('const openSettings = openWechatSubscriptionSettings()'), '首页必须通过点击链路打开订阅设置')
assert.ok(homePage.includes('getWechatSubscriptionSettings(notificationTemplateIds)'), '首页必须按模板读取微信订阅设置')
assert.ok(homePage.includes('openWechatSubscriptionSettings()'), '受限订阅必须跳转微信设置页')
assert.ok(homePage.includes('createDailyCheckin()'), '首页必须支持直接签到')
assert.ok(homePage.includes('settle(getMyDailyCheckinStatus())'), '首页必须加载签到状态')
assert.ok(homePage.includes('home-notification-guide'), '首页缺少通知引导浮层')
assert.ok(homePage.includes('setCustomTabBarHidden(shouldShowGuide)'), '通知引导出现时必须隐藏 TabBar')
assert.ok(homePage.includes('campus__checkin'), '首页缺少头部签到引导')
assert.ok(styles.includes('@media (prefers-reduced-motion: reduce)'), '新增引导必须兼容减少动态效果')
assert.ok(subscription.includes('accepted: templateIds.some'), '订阅模块必须返回用户是否接受模板')
assert.ok(subscription.includes('Taro.getSetting({ withSubscriptions: true })'), '订阅模块必须读取微信订阅总开关')
assert.ok(subscription.includes('withSubscriptions: true'), '订阅模块必须支持打开微信订阅设置')

console.log('home notification and check-in guide smoke: ok')
