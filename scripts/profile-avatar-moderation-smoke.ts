import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  AVATAR_MODERATION_MAX_NETWORK_FAILURES,
  AVATAR_MODERATION_MAX_POLLS,
  avatarModerationStorage,
  avatarModerationPollDelay,
  canRetryApprovedAvatarRefresh,
  isAvatarModerationUserId,
  resolveApprovedAvatarRefresh,
  resolveAvatarModerationOutcome,
} from '../src/features/profile/avatar-moderation'

assert.equal(resolveAvatarModerationOutcome('pending'), 'reviewing')
assert.equal(resolveAvatarModerationOutcome('checking'), 'reviewing')
assert.equal(resolveAvatarModerationOutcome('manual_review'), 'reviewing')
assert.equal(resolveAvatarModerationOutcome('passed'), 'approved')
assert.equal(resolveAvatarModerationOutcome('manual_approved'), 'approved')
assert.equal(resolveAvatarModerationOutcome('rejected'), 'rejected')
assert.equal(resolveAvatarModerationOutcome('manual_rejected'), 'rejected')
assert.equal(resolveAvatarModerationOutcome('error'), 'rejected')
assert.ok(AVATAR_MODERATION_MAX_POLLS > 1)
assert.ok(AVATAR_MODERATION_MAX_NETWORK_FAILURES > 1)
assert.ok(avatarModerationPollDelay(1) > avatarModerationPollDelay(0))
assert.equal(avatarModerationPollDelay(99), avatarModerationPollDelay(4))
assert.equal(canRetryApprovedAvatarRefresh(0, 1), true)
assert.equal(canRetryApprovedAvatarRefresh(AVATAR_MODERATION_MAX_NETWORK_FAILURES, 1), false)
assert.equal(canRetryApprovedAvatarRefresh(1, AVATAR_MODERATION_MAX_POLLS), false)
assert.equal(resolveApprovedAvatarRefresh(false, true), 'retry')
assert.equal(resolveApprovedAvatarRefresh(true, true), 'commit')
assert.equal(resolveApprovedAvatarRefresh(true, false), 'ignore')

const localStorage = new Map<string, unknown>()
const storage = {
  getStorageSync<T>(key: string) {
    return localStorage.get(key) as T
  },
  setStorageSync<T>(key: string, value: T) {
    localStorage.set(key, value)
  },
  removeStorageSync(key: string) {
    localStorage.delete(key)
  },
}

assert.ok(isAvatarModerationUserId(1))
assert.ok(!isAvatarModerationUserId(0))
assert.ok(avatarModerationStorage.write(storage, 1, 101))
assert.ok(avatarModerationStorage.write(storage, 2, 202))
assert.equal(avatarModerationStorage.read(storage, 1), 101)
assert.equal(avatarModerationStorage.read(storage, 2), 202)
assert.ok(avatarModerationStorage.remove(storage, 1))
assert.equal(avatarModerationStorage.read(storage, 1), null)
assert.equal(avatarModerationStorage.read(storage, 2), 202)
assert.equal(avatarModerationStorage.write(storage, 0, 303), false)

const profilePage = readFileSync(resolve(__dirname, '../src/pages/profile/index.tsx'), 'utf8')
const profileStyle = readFileSync(resolve(__dirname, '../src/pages/profile/index.scss'), 'utf8')
const mediaApi = readFileSync(resolve(__dirname, '../src/api/media.ts'), 'utf8')

assert.ok(mediaApi.includes("path: `/api/v1/media/${mediaId}`"), '审核轮询必须使用 owner-only 媒体查询接口')
assert.ok(profilePage.includes('getMedia(operation.mediaId)'), '个人页缺少头像审核状态轮询')
assert.ok(profilePage.includes('useDidHide'), '页面隐藏时必须停止头像审核轮询')
assert.ok(profilePage.includes('return stop'), '页面卸载时必须停止头像审核轮询')
assert.ok(profilePage.includes('avatarModerationStorage.read(Taro, account.user.id)'), '个人页必须恢复当前用户的待审头像')
assert.ok(profilePage.includes('avatarModerationStorage.write(Taro, operation.userId, mediaId)'), '绑定头像后必须持久化待审 mediaId')
assert.ok(profilePage.includes('avatarModerationStorage.remove(Taro, operation.userId)'), '终态与替换头像必须清理待审 mediaId')
assert.ok(profilePage.includes('profileVisibleRef.current'), '隐藏页面后不得应用旧的审核回调')
assert.ok(profilePage.includes('avatarOperationVersionRef.current'), '换图后不得应用旧的审核回调')
assert.ok(profilePage.includes('if (!isLatest()) return'), '换图后必须忽略旧上传回调')
assert.ok(profilePage.includes('if (!isCurrent()) return'), '隐藏页面后必须忽略旧上传回调')
const approvedBranch = profilePage.slice(
  profilePage.indexOf("if (outcome === 'approved')"),
  profilePage.indexOf("if (outcome === 'rejected')"),
)
assert.ok(approvedBranch.includes('const refreshedAccount = await loadCurrentUser('), '审核通过后必须强制刷新本人资料')
assert.ok(approvedBranch.indexOf('refreshedAccount') < approvedBranch.indexOf('avatarModerationStorage.remove'), '刷新成功前不得清理待审头像')
assert.ok(approvedBranch.includes("refreshResolution === 'retry'"), '刷新失败时必须保留待审头像以便重试')
assert.ok(approvedBranch.includes('approvedRefreshFailureCount += 1'), '刷新失败必须计入有界退避次数')
assert.ok(approvedBranch.includes('canRetryApprovedAvatarRefresh(approvedRefreshFailureCount, pollCount)'), '刷新失败重试必须受次数上限限制')
assert.ok(approvedBranch.includes('scheduleNext(approvedRefreshFailureCount)'), '刷新失败重试必须使用退避延迟')
assert.ok(profilePage.includes('头像审核未通过，请重新选择'), '审核不通过必须有明确且脱敏的提示')
assert.ok(!profilePage.includes('manual_rejected'), '页面不应展示微信审核原始状态')
assert.ok(profilePage.includes('approvedAvatarUrlRef'), '审核不通过后必须恢复已正式生效的旧头像')
assert.match(profileStyle, /\.profile-avatar-notice\s*\{[\s\S]*?&--rejected/u, '审核不通过需要页面内状态文案')
assert.match(profileStyle, /\.profile-avatar-notice\s*\{[\s\S]*?var\(--campus-surface-primary/u, '审核提示必须使用语义 surface token')
assert.match(profileStyle, /&--rejected\s*\{[\s\S]*?var\(--campus-surface-danger/u, '拒绝提示必须使用语义 danger token')
assert.match(profileStyle, /&__action\s*\{[\s\S]*?min-height:\s*88rpx/u, '重新选择头像的触控区域至少为 88rpx')
assert.ok(profilePage.includes("ariaLabel='重新选择头像'"), '重新选择头像必须有可访问按钮语义')

process.stdout.write('profile avatar moderation smoke: ok\n')
