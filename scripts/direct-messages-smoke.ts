import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  directMessageChatUrl,
  directMessagesListUrl,
  parseDirectMessageConversationId,
} from '../src/features/direct-messages/navigation'
import {
  isPrivateMessageNoticeAction,
  noticeActionRoute,
} from '../src/features/notices/action-route'
import {
  canLoadDirectMessagePage,
  displayedLastReceivedMessageId,
  historyPaginationFromDirectMessagePoll,
  mergeDirectMessageConversations,
  mergeDirectMessages,
} from '../src/features/direct-messages/pagination'
import { resolvePendingDirectMessageSend } from '../src/features/direct-messages/composer'
import { canRearmForegroundPrivateMessagePolling } from '../src/features/direct-messages/polling'

const root = resolve(__dirname, '..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

assert.equal(directMessagesListUrl, '/packages/social/direct-messages/index')
assert.equal(directMessageChatUrl(42), '/packages/social/direct-messages/chat?id=42')
assert.equal(directMessageChatUrl(0), directMessagesListUrl)
assert.equal(parseDirectMessageConversationId('42'), 42)
assert.equal(parseDirectMessageConversationId('invalid'), 0)
assert.equal(
  noticeActionRoute('/packages/social/direct-messages/chat?id=42'),
  directMessageChatUrl(42),
  '私信通知必须接受规范会话深链',
)
assert.equal(
  noticeActionRoute('/packages/social/direct-messages/chat?id=42', { allowPrivateMessages: false }),
  '',
  '资格版不得暴露私信通知跳转',
)
assert.equal(
  noticeActionRoute('/packages/social/direct-messages/chat?id=42&next=/pages/index/index'),
  '',
  '私信通知不得接受附加跳转参数',
)
assert.equal(
  noticeActionRoute('/pages/notices/detail?notice_id=42&source=push'),
  '/pages/notices/detail?notice_id=42&source=push',
  '既有 pages 通知跳转必须保持兼容',
)
assert.equal(isPrivateMessageNoticeAction('/packages/social/direct-messages/chat?id=42'), true)
assert.equal(isPrivateMessageNoticeAction('/packages/social/direct-messages/chat?id=0'), false)

const messages = [
  { id: 4, conversation_id: 9, sender_id: 7, content: '较早消息', created_at: '2026-08-18T08:00:00+08:00' },
  { id: 8, conversation_id: 9, sender_id: 3, content: '我的回复', created_at: '2026-08-18T08:03:00+08:00' },
] as Parameters<typeof mergeDirectMessages>[0]
const mergedMessages = mergeDirectMessages(messages, [
  { id: 4, conversation_id: 9, sender_id: 7, content: '较早消息已更新', created_at: '2026-08-18T08:00:00+08:00' },
  { id: 11, conversation_id: 9, sender_id: 7, content: '新消息', created_at: '2026-08-18T08:05:00+08:00' },
] as Parameters<typeof mergeDirectMessages>[1])
assert.deepEqual(mergedMessages.map((item) => item.id), [4, 8, 11])
assert.equal(displayedLastReceivedMessageId(mergedMessages, 3), 11)
assert.equal(displayedLastReceivedMessageId(mergedMessages, 7), 8)
assert.equal(canLoadDirectMessagePage(false, true, 'cursor'), true)
assert.equal(canLoadDirectMessagePage(true, true, 'cursor'), false)
assert.equal(canLoadDirectMessagePage(false, false, 'cursor'), false)
assert.equal(canLoadDirectMessagePage(false, true, null), false)
assert.deepEqual(historyPaginationFromDirectMessagePoll(0, {
  has_more: true,
  next_cursor: 'older-page',
}), { hasMore: true, nextCursor: 'older-page' }, '首个轮询必须保留更早消息游标')
assert.equal(historyPaginationFromDirectMessagePoll(11, {
  has_more: true,
  next_cursor: 'older-page',
}), null, '增量轮询不得覆盖已加载历史游标')

let generatedKeyCount = 0
const createPendingKey = () => `key-${++generatedKeyCount}`
const firstPendingSend = resolvePendingDirectMessageSend('你好', null, '', createPendingKey)
assert.deepEqual(firstPendingSend, { content: '你好', idempotencyKey: 'key-1' })
assert.equal(
  resolvePendingDirectMessageSend('你好', firstPendingSend, '你好', createPendingKey),
  firstPendingSend,
  '失败重试且草稿未变时必须复用幂等键',
)
assert.deepEqual(
  resolvePendingDirectMessageSend('换一句', firstPendingSend, '你好', createPendingKey),
  { content: '换一句', idempotencyKey: 'key-2' },
  '草稿变更后必须生成新的幂等键',
)
assert.deepEqual(
  resolvePendingDirectMessageSend('你好 ', firstPendingSend, '你好', createPendingKey),
  { content: '你好', idempotencyKey: 'key-3' },
  '草稿编辑即使不改变修剪后的内容也必须生成新的幂等键',
)
assert.equal(resolvePendingDirectMessageSend('', firstPendingSend, '你好', createPendingKey), null)

assert.equal(canRearmForegroundPrivateMessagePolling(true, 3, 3), true)
assert.equal(canRearmForegroundPrivateMessagePolling(false, 3, 3), false)
assert.equal(canRearmForegroundPrivateMessagePolling(true, 3, 4), false)

const conversations = mergeDirectMessageConversations([
  { id: 2, peer: { id: 7, nickname: '同学', avatar_url: null, deleted: false }, last_message: null, unread_count: 0, created_at: '2026-08-18T08:00:00+08:00', last_activity_at: '2026-08-18T08:00:00+08:00' },
] as Parameters<typeof mergeDirectMessageConversations>[0], [
  { id: 2, peer: { id: 7, nickname: '同学', avatar_url: null, deleted: false }, last_message: null, unread_count: 2, created_at: '2026-08-18T08:00:00+08:00', last_activity_at: '2026-08-18T08:05:00+08:00' },
  { id: 5, peer: { id: 9, nickname: '朋友', avatar_url: null, deleted: false }, last_message: null, unread_count: 0, created_at: '2026-08-18T08:01:00+08:00', last_activity_at: '2026-08-18T08:01:00+08:00' },
] as Parameters<typeof mergeDirectMessageConversations>[1])
assert.deepEqual(conversations.map((item) => [item.id, item.unread_count]), [[2, 2], [5, 0]])

const repository = read('src/features/direct-messages/repository.ts')
const generated = read('src/api/generated/schema.ts')
const appConfig = read('src/app.config.ts')
const messagesPage = read('src/pages/messages/index.tsx')
const publicProfile = read('src/pages/public-profile/index.tsx')
const chatPage = read('src/packages/social/direct-messages/chat.tsx')
const runtimeConfig = read('src/features/runtime-config/index.ts')
const subscriptionModule = read('src/features/wechat-subscription/module.ts')
const tabBar = read('src/custom-tab-bar/index.wxml')
const qualificationSmoke = read('scripts/qualification-build-smoke.ts')
const appSource = read('src/app.ts')
const unreadSource = read('src/features/direct-messages/unread.ts')

for (const path of [
  '/api/v1/private-messages/conversations',
  '/messages',
  '/read-watermark',
  '/api/v1/private-messages/unread-count',
]) {
  assert.ok(repository.includes(path), `私信仓储缺少 ${path}`)
}
assert.ok(repository.includes('after_id: query.afterId'), '轮询必须使用 after_id 契约')
assert.ok(repository.includes('idempotencyKey'), '发送消息必须带幂等键')
assert.ok(generated.includes('GetPrivateMessageUnreadCount'), '生成类型缺少私信未读总数操作')
assert.ok(generated.includes('ListPrivateMessages'), '生成类型缺少消息游标操作')
assert.ok(appConfig.includes("'direct-messages/index'"), '完整版本必须注册私信会话页')
assert.ok(appConfig.includes("'pages/direct-messages/index'"), '资格版排除清单必须包含私信会话页')
assert.ok(appConfig.includes("'pages/direct-messages/chat'"), '资格版排除清单必须包含私信详情页')
assert.ok(messagesPage.includes('!isQualificationEdition'), '资格版不得显示私信入口')
assert.ok(messagesPage.includes("openMiniappModule('private_message'"), '消息中心私信入口必须经过模块守卫')
assert.ok(messagesPage.includes("resolveMiniappModule(runtimeConfig, 'private_message').state !== 'hidden'"), '隐藏模块不得展示消息中心私信入口')
assert.ok(messagesPage.includes('canOpenNoticeAction'), '隐藏模块不得显示私信通知 CTA')
assert.ok(publicProfile.includes('!profile.is_self'), '个人主页不得展示给自己的私信入口')
assert.ok(publicProfile.includes('isQualificationEdition'), '资格版不得显示个人主页私信入口')
assert.ok(publicProfile.includes("openMiniappModule(\n        'private_message'"), '个人主页私信入口必须经过模块守卫')
assert.ok(publicProfile.includes("requestWechatSubscriptionForModule(\n      'private_message'"), '个人主页必须在建会话前预请求私信订阅')
assert.ok(publicProfile.includes('subscriptionAlreadyRequested'), '个人主页预请求后不得重复订阅')
assert.ok(chatPage.includes('KeyboardSafeInput'), '聊天输入必须使用 KeyboardSafeInput')
assert.ok(chatPage.includes('useKeyboardInset'), '聊天输入栏必须仅随键盘移动')
assert.ok(chatPage.includes('afterId: afterId || undefined'), '聊天轮询必须按 after_id 增量请求')
assert.ok(chatPage.includes('POLL_INTERVAL_MS = 4_000'), '聊天轮询间隔必须约为 4 秒')
assert.ok(chatPage.includes('POLL_MAX_BACKOFF_MS'), '聊天轮询失败必须退避')
assert.ok(chatPage.includes('historyPaginationFromDirectMessagePoll'), '首个轮询必须回填历史游标')
assert.ok(chatPage.includes('pendingSendRef'), '发送失败必须保留待重试幂等键')
assert.ok(chatPage.includes("requestWechatSubscriptionForModule('private_message')"), '发送按钮必须显式请求私信订阅')
assert.ok(!chatPage.includes("from '@tarojs/components'\nimport { Input"), '聊天页不得直接使用原生 Input')
assert.ok(subscriptionModule.includes("'private_message'"), '私信路由必须映射订阅模块')
assert.ok(runtimeConfig.includes("'private_message'"), '运行时配置必须识别私信模块')
assert.ok(runtimeConfig.includes("private_message: { state: 'hidden' }"), '未配置私信模块时必须默认隐藏')
assert.ok(runtimeConfig.includes('isModuleConfig(value[key]) ? value[key] : conservativeModules[key]'), '缺失模块配置必须回退到保守默认值')
assert.ok(runtimeConfig.includes('subscriptionAlreadyRequested'), '模块导航必须跳过已在点击链路内发起的订阅')
assert.ok(tabBar.includes('privateUnreadCount'), '消息 Tab 必须展示私信未读徽标')
assert.ok(qualificationSmoke.includes("'packages/social/direct-messages/chat'"), '资格版构建检查必须排除私信详情页')
assert.ok(appSource.includes('privateMessageUnreadVisibleRef.current'), '未读轮询必须在页面隐藏时暂停')
assert.ok(appSource.includes('privateMessageUnreadPollingGeneration.current'), '未读轮询必须使用可见性代际防止隐藏后重启')
assert.ok(unreadSource.includes("resolveMiniappModule(getMiniappRuntimeConfig(), 'private_message').state !== 'enabled'"), '未启用私信模块不得请求未读接口')

console.log('direct messages smoke: ok')
