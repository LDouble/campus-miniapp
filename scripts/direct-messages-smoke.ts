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
import type { MediaView } from '../src/api/media'
import {
  privateMessageImageFrameSize,
  privateMessageMediaReviewMessage,
  privateMessageMediaReviewState,
} from '../src/features/direct-messages/media-review'

const root = resolve(__dirname, '..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

assert.equal(directMessagesListUrl, '/pages/direct-messages/index')
assert.equal(directMessageChatUrl(42), '/pages/direct-messages/chat?id=42')
assert.equal(directMessageChatUrl(0), directMessagesListUrl)
assert.equal(parseDirectMessageConversationId('42'), 42)
assert.equal(parseDirectMessageConversationId('invalid'), 0)
assert.equal(
  noticeActionRoute('/pages/direct-messages/chat?id=42'),
  directMessageChatUrl(42),
  '私信通知必须接受规范会话深链',
)
assert.equal(
  noticeActionRoute('/pages/direct-messages/chat?id=42', { allowPrivateMessages: false }),
  '',
  '资格版不得暴露私信通知跳转',
)
assert.equal(
  noticeActionRoute('/pages/direct-messages/chat?id=42&next=/pages/index/index'),
  '',
  '私信通知不得接受附加跳转参数',
)
assert.equal(
  noticeActionRoute('/pages/notices/detail?notice_id=42&source=push'),
  '/pages/notices/detail?notice_id=42&source=push',
  '既有 pages 通知跳转必须保持兼容',
)
assert.equal(isPrivateMessageNoticeAction('/pages/direct-messages/chat?id=42'), true)
assert.equal(isPrivateMessageNoticeAction('/pages/direct-messages/chat?id=0'), false)

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
const firstPendingSend = resolvePendingDirectMessageSend({
  draft: '你好',
  pending: null,
  pendingFingerprint: '',
  createKey: createPendingKey,
})
assert.deepEqual(firstPendingSend, {
  payload: { kind: 'text', content: '你好' },
  fingerprint: 'text:你好',
  idempotencyKey: 'key-1',
})
assert.equal(
  resolvePendingDirectMessageSend({
    draft: '你好',
    pending: firstPendingSend,
    pendingFingerprint: 'text:你好',
    createKey: createPendingKey,
  }),
  firstPendingSend,
  '失败重试且草稿未变时必须复用幂等键',
)
assert.deepEqual(
  resolvePendingDirectMessageSend({
    draft: '换一句',
    pending: firstPendingSend,
    pendingFingerprint: 'text:你好',
    createKey: createPendingKey,
  }),
  { payload: { kind: 'text', content: '换一句' }, fingerprint: 'text:换一句', idempotencyKey: 'key-2' },
  '草稿变更后必须生成新的幂等键',
)
assert.deepEqual(
  resolvePendingDirectMessageSend({
    draft: '你好 ',
    pending: firstPendingSend,
    pendingFingerprint: 'text:你好',
    createKey: createPendingKey,
  }),
  { payload: { kind: 'text', content: '你好' }, fingerprint: 'text:你好 ', idempotencyKey: 'key-3' },
  '草稿编辑即使不改变修剪后的内容也必须生成新的幂等键',
)
assert.equal(resolvePendingDirectMessageSend({
  draft: '',
  pending: firstPendingSend,
  pendingFingerprint: 'text:你好',
  createKey: createPendingKey,
}), null)
const firstImagePendingSend = resolvePendingDirectMessageSend({
  draft: '',
  mediaId: 44,
  pending: null,
  pendingFingerprint: '',
  createKey: createPendingKey,
})
assert.deepEqual(firstImagePendingSend, {
  payload: { kind: 'image', mediaId: 44 },
  fingerprint: 'image:44',
  idempotencyKey: 'key-4',
})
assert.equal(
  resolvePendingDirectMessageSend({
    draft: '',
    mediaId: 44,
    pending: firstImagePendingSend,
    pendingFingerprint: 'image:44',
    createKey: createPendingKey,
  }),
  firstImagePendingSend,
  '图片发送失败重试必须复用相同媒体 ID 的幂等键',
)
assert.deepEqual(
  resolvePendingDirectMessageSend({
    draft: '',
    mediaId: 45,
    pending: firstImagePendingSend,
    pendingFingerprint: 'image:44',
    createKey: createPendingKey,
  }),
  { payload: { kind: 'image', mediaId: 45 }, fingerprint: 'image:45', idempotencyKey: 'key-5' },
  '选择另一张图片后必须生成新的幂等键',
)

const mediaForReview = (
  moderationStatus: MediaView['moderation_status'],
  status: MediaView['status'] = 'ready',
) => ({
  id: 44,
  purpose: 'private_message' as const,
  status,
  moderation_status: moderationStatus,
  version: 1,
  width: 1200,
  height: 800,
})
assert.equal(privateMessageMediaReviewState('manual_approved'), 'passed')
assert.equal(privateMessageMediaReviewState('manual_rejected'), 'rejected')
const reviewStateCases: Array<{
  name: string
  moderationStatus: MediaView['moderation_status']
  state: 'pending' | 'passed' | 'rejected'
  message: string
}> = [
  {
    name: 'pending',
    moderationStatus: 'pending',
    state: 'pending',
    message: '图片正在提交审核',
  },
  {
    name: 'checking',
    moderationStatus: 'checking',
    state: 'pending',
    message: '图片审核中，请稍候',
  },
  {
    name: 'manual review',
    moderationStatus: 'manual_review',
    state: 'pending',
    message: '图片正在人工审核，请稍候',
  },
  {
    name: 'error',
    moderationStatus: 'error',
    state: 'rejected',
    message: '图片审核暂时失败，请重试',
  },
  {
    name: 'rejected',
    moderationStatus: 'rejected',
    state: 'rejected',
    message: '图片未通过审核，请更换后重试',
  },
  {
    name: 'manual rejected',
    moderationStatus: 'manual_rejected',
    state: 'rejected',
    message: '图片未通过审核，请更换后重试',
  },
  {
    name: 'passed',
    moderationStatus: 'passed',
    state: 'passed',
    message: '',
  },
  {
    name: 'manual approved',
    moderationStatus: 'manual_approved',
    state: 'passed',
    message: '',
  },
]
reviewStateCases.forEach((test) => {
  const media = mediaForReview(test.moderationStatus)
  assert.equal(privateMessageMediaReviewState(media), test.state, `${test.name} state`)
  assert.equal(privateMessageMediaReviewMessage(media), test.message, `${test.name} message`)
})
const expiredMedia = mediaForReview('passed', 'expired')
assert.equal(privateMessageMediaReviewState(expiredMedia), 'rejected', '媒体过期后不得继续当作审核通过')
assert.equal(privateMessageMediaReviewMessage(expiredMedia), '图片已失效')
assert.deepEqual(privateMessageImageFrameSize(1200, 800), { width: '260rpx', height: '173rpx' })
assert.deepEqual(privateMessageImageFrameSize(600, 1200), { width: '144rpx', height: '260rpx' })
assert.deepEqual(privateMessageImageFrameSize(800, 800), { width: '260rpx', height: '260rpx' })
assert.deepEqual(privateMessageImageFrameSize(0, 0), { width: '260rpx', height: '260rpx' }, '缺少尺寸时必须使用稳定方形占位')

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
const conversationPage = read('src/pages/direct-messages/index.tsx')
const conversationStyle = read('src/pages/direct-messages/index.scss')
const publicProfile = read('src/pages/public-profile/index.tsx')
const chatPage = read('src/pages/direct-messages/chat.tsx')
const chatStyle = read('src/pages/direct-messages/chat.scss')
const runtimeConfig = read('src/features/runtime-config/index.ts')
const subscriptionModule = read('src/features/wechat-subscription/module.ts')
const tabBar = read('src/custom-tab-bar/index.wxml')
const qualificationSmoke = read('scripts/qualification-build-smoke.ts')
const appSource = read('src/app.ts')
const authSource = read('src/api/auth.ts')
const unreadSource = read('src/features/direct-messages/unread.ts')
const mediaApi = read('src/api/media.ts')
const mediaReview = read('src/features/direct-messages/media-review.ts')

assert.match(
  authSource,
  /getMiniProgramEnvVersion[\s\S]*Taro\.getAccountInfoSync[\s\S]*miniProgram\.envVersion/u,
  '开发环境展示必须复用运行时小程序 envVersion 判断',
)
assert.match(
  authSource,
  /isDevelopmentEnvironment = \(\) => getMiniProgramEnvVersion\(\) !== 'release'/u,
  '非生产环境展示不得根据 API 域名字符串判断',
)

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
assert.ok(repository.includes('media_id: payload.mediaId'), '图片消息必须仅提交 media_id')
assert.ok(generated.includes('GetPrivateMessageUnreadCount'), '生成类型缺少私信未读总数操作')
assert.ok(generated.includes('ListPrivateMessages'), '生成类型缺少消息游标操作')
assert.ok(generated.includes('PrivateMessageImage'), '生成类型缺少私信图片结构')
assert.ok(generated.includes('PrivateMessageImageState'), '生成类型缺少私信图片审核状态结构')
assert.ok(generated.includes('image_state'), '生成类型缺少私信图片审核状态字段')
assert.ok(generated.includes('private_message'), '生成类型缺少私信图片用途')
assert.ok(appConfig.includes("'pages/direct-messages/index'"), '完整版本必须注册私信会话页')
assert.ok(appConfig.includes("'pages/direct-messages/index'"), '资格版排除清单必须包含私信会话页')
assert.ok(appConfig.includes("'pages/direct-messages/chat'"), '资格版排除清单必须包含私信详情页')
assert.ok(messagesPage.includes('!isQualificationEdition'), '资格版不得显示私信入口')
assert.ok(messagesPage.includes('isDevelopmentEnvironment'), '消息中心必须根据运行时环境切换展示')
assert.ok(messagesPage.includes('暂无新的通知内容'), '开发环境消息列表不得展示私聊空态文案')
assert.ok(messagesPage.includes("openMiniappModule('private_message'"), '消息中心私信入口必须经过模块守卫')
assert.ok(messagesPage.includes("resolveMiniappModule(runtimeConfig, 'private_message').state !== 'hidden'"), '隐藏模块不得展示消息中心私信入口')
assert.ok(messagesPage.includes('canOpenNoticeAction'), '隐藏模块不得显示私信通知 CTA')
assert.ok(conversationPage.includes('plainStickerContent'), '会话预览必须将表情降级为可读文本')
assert.ok(conversationPage.includes('在同学的个人主页点“发私信”开始聊天'), '私信会话页必须提供开始聊天引导')
assert.ok(
  conversationPage.includes('const firstDidShow = useRef(true)')
    && conversationPage.includes('if (firstDidShow.current)')
    && conversationPage.includes('void load(true)')
    && conversationPage.includes('void syncOpenedConversation()'),
  '私信列表返回详情时不得重置已加载分页',
)
assert.ok(
  conversationPage.includes('openedConversationIdRef')
    && conversationPage.includes('privateMessagesRepository.getConversation(conversationId)')
    && conversationPage.includes('只更新当前会话摘要'),
  '私信列表返回详情后必须非阻塞同步当前会话摘要',
)
assert.ok(!conversationStyle.includes('radial-gradient'), '私信会话页不得保留旧的径向渐变背景')
assert.ok(publicProfile.includes('!profile.is_self'), '个人主页不得展示给自己的私信入口')
assert.ok(publicProfile.includes('!developmentPresentation'), '开发环境个人主页不得展示私信入口')
assert.ok(publicProfile.includes('isQualificationEdition'), '资格版不得显示个人主页私信入口')
assert.ok(publicProfile.includes("openMiniappModule(\n        'private_message'"), '个人主页私信入口必须经过模块守卫')
assert.ok(publicProfile.includes("requestWechatSubscriptionForModule(\n      'private_message'"), '个人主页必须在建会话前预请求私信订阅')
assert.ok(publicProfile.includes('subscriptionAlreadyRequested'), '个人主页预请求后不得重复订阅')
assert.ok(chatPage.includes('KeyboardSafeInput'), '聊天输入必须使用 KeyboardSafeInput')
assert.ok(chatPage.includes('if (developmentPresentation) return'), '开发环境聊天必须禁止发送')
assert.ok(chatPage.includes('displayedMessages'), '开发环境聊天只展示对方消息')
assert.ok(chatStyle.includes('.direct-chat-composer {\n    display: none;'), '开发环境聊天必须隐藏回复输入框')
assert.ok(chatPage.includes('useKeyboardInset'), '聊天输入栏必须仅随键盘移动')
assert.ok(chatPage.includes('StickerContent'), '聊天消息必须渲染已知表情图片')
assert.ok(chatPage.includes('StickerPicker'), '聊天输入栏必须提供表情选择面板')
assert.ok(chatPage.includes('insertStickerToken'), '聊天表情选择必须插入可读表情标记')
assert.ok(chatPage.includes('if (keyboardHeight > 0) setStickerPickerOpen(false)'), '键盘和表情面板必须互斥')
assert.ok(chatPage.includes("require('../../assets/icons/smile.svg')"), '聊天表情入口必须使用既有 smile 图标')
assert.ok(chatPage.includes("require('../../assets/icons/image.svg')"), '聊天图片入口必须使用既有 image 图标')
assert.ok(chatPage.includes('chooseMediaImages({ count: 1 })'), '聊天图片入口必须限制为单图选择')
assert.ok(chatPage.includes("purpose: 'private_message'"), '聊天图片必须使用私信媒体用途')
assert.ok(chatPage.includes('await sendUploadedImage'), '图片上传完成后必须自动发送消息')
assert.ok(chatPage.includes('pendingOutgoingImage'), '图片选择后必须先在消息流展示本地预览')
assert.ok(chatPage.includes('image_state?.state'), '聊天页必须消费服务端图片审核状态')
assert.ok(chatPage.includes('图片已失效'), '审核拒绝或媒体失效必须显示失效文案')
assert.ok(!chatPage.includes('getMedia'), '聊天页不应自行查询媒体详情兼容旧服务端')
assert.ok(!chatPage.includes('submitPrivateMessageMediaReview'), '聊天页不应调用旧版审核提交接口')
assert.ok(!chatPage.includes('pollPrivateMessageMediaReview'), '聊天页不应主动轮询图片审核状态')
assert.ok(!chatPage.includes('onTransientLoadError'), '聊天页不应为审核状态维护后台轮询')
assert.ok(!chatPage.includes('审核中'), '发送成功后不应额外悬挂审核中卡片')
assert.ok(chatPage.includes('Taro.previewImage'), '聊天图片必须支持点击预览')
assert.ok(chatPage.includes("ariaLabel='预览图片消息'"), '聊天图片缩略图必须提供可访问预览名称')
assert.ok(chatPage.includes('retryMessageImage(message.id)'), '聊天图片加载失败后必须支持刷新重试')
assert.ok(chatPage.includes('void loadInitial(conversationIdRef.current)'), '图片刷新重试必须请求新的消息图片地址')
assert.ok(chatPage.includes("state === 'rejected' || state === 'expired'"), '服务端直接返回失效态时不得展示图片预览')
assert.ok(chatPage.includes('imageInFlight'), '图片发送中必须独立维护图片入口状态')
assert.ok(chatPage.includes('!draft.trim() || sending || !conversationId'), '图片发送期间文字发送不得被阻塞')
assert.ok(!chatPage.includes('图片将单独发送'), '图片发送期间不得替换文字输入提示')
assert.ok(!chatPage.includes('direct-chat-composer__image-hint'), '图片发送期间不得隐藏文字输入框')
assert.ok(!chatPage.includes('direct-chat-composer__image-draft'), '图片发送状态不得悬挂在输入区')
assert.ok(chatPage.includes('direct-chat-message__image-progress-actions'), '图片发送失败状态必须留在消息流中')
assert.ok(chatStyle.includes('.direct-chat-message__image-frame'), '聊天图片必须保持稳定比例容器')
assert.ok(chatStyle.includes('.direct-chat-message__image-fallback'), '聊天图片加载失败必须有占位')
assert.ok(chatStyle.includes('.direct-chat-message__image-progress-action'), '图片发送失败操作必须提供明确的消息流操作样式')
assert.ok(mediaApi.includes('getMedia'), '媒体 API 必须封装私信审核查询')
assert.ok(!mediaApi.includes('submitPrivateMessageMediaReview'), '媒体 API 不应暴露私信旧版审核提交接口')
assert.ok(!mediaReview.includes('pollPrivateMessageMediaReview'), '审核状态工具不应提供前台轮询')
assert.equal(
  (chatPage.match(/const version = initialRequestVersion\.current \+ 1/g) || []).length,
  1,
  '会话初始加载只能递增一次请求版本',
)
assert.ok(!chatStyle.includes('radial-gradient'), '聊天页不得保留旧的径向渐变背景')
assert.ok(!chatStyle.includes('backdrop-filter'), '聊天输入栏不得使用玻璃模糊')
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
assert.ok(tabBar.includes('unreadCount > 0'), '消息 Tab 必须展示合并后的消息未读徽标')
assert.ok(qualificationSmoke.includes("'pages/direct-messages/chat'"), '资格版构建检查必须排除私信详情页')
assert.ok(appSource.includes('privateMessageUnreadVisibleRef.current'), '未读轮询必须在页面隐藏时暂停')
assert.ok(appSource.includes('privateMessageUnreadPollingGeneration.current'), '未读轮询必须使用可见性代际防止隐藏后重启')
assert.ok(unreadSource.includes("resolveMiniappModule(getMiniappRuntimeConfig(), 'private_message').state !== 'enabled'"), '未启用私信模块不得请求未读接口')

console.log('direct messages smoke: ok')
