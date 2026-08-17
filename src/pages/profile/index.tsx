import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import UserAvatarImage from '../../components/user-avatar-image'
import { KeyboardSafeInput } from '../../components/keyboard-safe-input'
import { getCurrentUser, updateCurrentAvatar, updateCurrentUsername } from '../../api/account'
import { getAcademicVerificationStatus } from '../../api/academic-verification'
import { isApiError } from '../../api/client'
import { uploadMediaImage } from '../../api/media'
import type {
  AcademicVerificationStatus,
  CurrentUser,
  DailyCheckinStatus,
  UserLevelSummary,
} from '../../api/types'
import { getMyUserLevel } from '../../api/user-levels'
import { getMyDailyCheckinStatus } from '../../api/daily-checkins'
import { openMiniProgramPrivacyContract } from '../../features/privacy/contract'
import {
  normalizeUsername,
  USERNAME_MAX_LENGTH,
  validateUsername,
} from '../../features/profile/username'
import { isQualificationEdition } from '../../features/app-edition'
import {
  AVATAR_IMAGE_MAX_DIMENSION,
  AVATAR_IMAGE_QUALITY,
} from '../../features/media/images'
import type { MediaImageDraft } from '../../features/media/images'
import { chooseMediaImages } from '../../features/media/selection'
import { syncCustomTabBar } from '../../utils/tabbar'
import { openPublicProfile } from '../../features/profile/public-profile'
import './index.scss'

const icons = {
  arrow: require('../../assets/icons/arrow.svg'),
  schedule: require('../../assets/icons/calendar.svg'),
  materials: require('../../assets/icons/materials.svg'),
  published: require('../../assets/icons/community.svg'),
  accepted: require('../../assets/icons/errands.svg'),
  orders: require('../../assets/icons/market.svg'),
  carpool: require('../../assets/icons/shuttle.svg'),
  identity: require('../../assets/icons/academic.svg'),
  privacy: require('../../assets/icons/study.svg'),
  account: require('../../assets/icons/profile.svg'),
}

const menus = [
  {
    key: 'schedule',
    name: '我的课表',
    icon: icons.schedule,
    route: '/pages/academic/schedule/index',
  },
  {
    key: 'materials',
    name: '我的资料',
    icon: icons.materials,
    route: '/pages/materials/index?view=mine',
  },
  {
    key: 'published',
    name: '我的发布',
    icon: icons.published,
    route: '/packages/social/my-services/index?section=published',
  },
  {
    key: 'accepted',
    name: '我的接单',
    icon: icons.accepted,
    route: '/packages/social/my-services/index?section=errands&relation=accepted',
  },
  {
    key: 'orders',
    name: '我的订单',
    icon: icons.orders,
    route: '/packages/social/my-services/index?section=orders&relation=all',
  },
  {
    key: 'carpool',
    name: '我的同行',
    icon: icons.carpool,
    route: '/packages/social/my-services/index?section=carpool&relation=all',
  },
] as const

const visibleMenus = isQualificationEdition
  ? menus.filter((item) => item.key === 'schedule')
  : menus

const identityMenu = {
  key: 'identity',
  name: '校园身份',
  icon: icons.identity,
  route: '/pages/academic-verification/index',
} as const

const userAvatarUrl = (user?: CurrentUser['user'] | null) => (
  user?.avatar_url || ''
)

export default function ProfilePage() {
  const [academicStatus, setAcademicStatus] = useState<AcademicVerificationStatus | null>(null)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [accountLoaded, setAccountLoaded] = useState(false)
  const [userLevel, setUserLevel] = useState<UserLevelSummary | null>(null)
  const [checkinStatus, setCheckinStatus] = useState<DailyCheckinStatus | null>(null)
  const [editingUsername, setEditingUsername] = useState(false)
  const [usernameDraft, setUsernameDraft] = useState('')
  const [savingUsername, setSavingUsername] = useState(false)
  const [avatarDraft, setAvatarDraft] = useState<MediaImageDraft | null>(null)
  const [savingAvatar, setSavingAvatar] = useState(false)
  const loadCurrentUser = async (showError = false, force = false) => {
    setAccountLoaded(false)
    try {
      const account = await getCurrentUser({ force })
      setCurrentUser(account)
      setUsernameDraft(account.user.username)
    } catch {
      if (showError) {
        Taro.showToast({ title: '账号信息加载失败，请稍后重试', icon: 'none' })
      }
    } finally {
      setAccountLoaded(true)
    }
  }
  useDidShow(() => {
    syncCustomTabBar('profile')
    setCheckinStatus(null)
    void loadCurrentUser()
    void getAcademicVerificationStatus().then((status) => {
      setAcademicStatus(status)
    }).catch(() => {
      // 个人页保留可用，认证页会提供完整错误重试。
    })
    void getMyUserLevel().then(setUserLevel).catch(() => {
      // 等级信息不影响个人中心其余入口。
    })
    void getMyDailyCheckinStatus().then(setCheckinStatus).catch(() => {
      // 签到状态失败时仍保留入口，详情页提供完整错误重试。
    })
  })
  const openMenu = (item: typeof menus[number] | typeof identityMenu) => {
    Taro.navigateTo({ url: item.route })
  }
  const openPrivacy = async () => {
    try {
      await openMiniProgramPrivacyContract()
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '隐私保护指引暂不可用',
        icon: 'none',
      })
    }
  }
  const beginUsernameEdit = () => {
    if (!currentUser) {
      if (accountLoaded) {
        void loadCurrentUser(true)
      } else {
        Taro.showToast({ title: '账号信息加载中', icon: 'none' })
      }
      return
    }
    setUsernameDraft(currentUser.user.username)
    setEditingUsername(true)
  }
  const cancelUsernameEdit = () => {
    if (savingUsername) return
    setUsernameDraft(currentUser?.user.username || '')
    setEditingUsername(false)
  }
  const saveUsername = async () => {
    if (!currentUser || savingUsername) return
    const message = validateUsername(usernameDraft)
    if (message) {
      Taro.showToast({ title: message, icon: 'none' })
      return
    }
    const username = normalizeUsername(usernameDraft)
    if (username === currentUser.user.username) {
      setEditingUsername(false)
      return
    }
    setSavingUsername(true)
    try {
      const updated = await updateCurrentUsername(username)
      setCurrentUser((account) => account ? { ...account, user: updated } : account)
      setUsernameDraft(updated.username)
      setEditingUsername(false)
      Taro.showToast({ title: '昵称已更新', icon: 'success' })
    } catch (error) {
      Taro.showToast({
        title: isApiError(error) ? error.message : '昵称更新失败，请稍后重试',
        icon: 'none',
      })
    } finally {
      setSavingUsername(false)
    }
  }
  const applyAvatar = async (draft: MediaImageDraft) => {
    if (savingAvatar) return
    setSavingAvatar(true)
    setAvatarDraft({ ...draft, status: 'uploading', error: '' })
    try {
      const mediaId = draft.mediaId || (await uploadMediaImage({
        purpose: 'avatar',
        filePath: draft.localPath,
        mimeType: draft.mimeType,
        sizeBytes: draft.sizeBytes,
        onProgress: (progress) => setAvatarDraft((currentDraft) => (
          currentDraft?.key === draft.key
            ? { ...currentDraft, status: 'uploading', progress }
            : currentDraft
        )),
      })).id
      setAvatarDraft((currentDraft) => currentDraft?.key === draft.key
        ? { ...currentDraft, mediaId, status: 'uploading', progress: 100 }
        : currentDraft)
      const updated = await updateCurrentAvatar(mediaId)
      setCurrentUser((account) => account ? { ...account, user: updated } : account)
      setAvatarDraft((currentDraft) => currentDraft?.key === draft.key
        ? { ...currentDraft, mediaId, status: 'uploaded', progress: 100, error: '' }
        : currentDraft)
      Taro.showToast({ title: '头像审核中', icon: 'none' })
    } catch (error) {
      setAvatarDraft((currentDraft) => currentDraft?.key === draft.key
        ? {
          ...currentDraft,
          status: 'failed',
          error: isApiError(error) ? error.message : '头像更新失败，请重试',
        }
        : currentDraft)
    } finally {
      setSavingAvatar(false)
    }
  }
  const chooseAvatar = async () => {
    if (savingAvatar) return
    try {
      const [selected] = await chooseMediaImages({
        count: 1,
        cropSquare: true,
        maxDimension: AVATAR_IMAGE_MAX_DIMENSION,
        quality: AVATAR_IMAGE_QUALITY,
      })
      if (!selected) return
      setAvatarDraft(selected)
      await applyAvatar(selected)
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '头像选择失败',
        icon: 'none',
      })
    }
  }
  const identity = academicStatus?.identity
  const latestRequest = academicStatus?.latest_request
  const identityVerified = identity?.status === 'verified'
  const identityPending = !identityVerified && latestRequest?.status === 'pending'
  const identityMeta = identityVerified
    ? `已认证 · ${identity?.method === 'credentials' ? '教务账号' : '学生证'}`
    : identityPending
      ? '校园身份认证中'
      : latestRequest?.status === 'rejected'
        ? '认证未通过，点击处理'
        : '待认证'
  const identityBadgeText = identityVerified
    ? '已认证'
    : identityPending
      ? '认证中'
      : '去认证'
  const studentNumber = identityVerified
    ? `${identity.student_no.slice(0, 2)}****${identity.student_no.slice(-2)}`
    : ''
  const displayName = currentUser?.user.username || identity?.real_name || '海大同学'
  const accountDescription = identityVerified
    ? `${identity.real_name} · 学号 ${studentNumber}`
    : '中国海洋大学校园服务账号'
  const avatarUrl = avatarDraft?.previewUrl || userAvatarUrl(currentUser?.user)
  const openMyPublicProfile = () => {
    if (!currentUser) {
      Taro.showToast({ title: accountLoaded ? '账号信息加载失败' : '账号信息加载中', icon: 'none' })
      return
    }
    void openPublicProfile(currentUser.user.id)
  }

  return (
    <View className='profile-page'>
      <CustomNavbar title='我的' />

      <View className='profile-page__content'>
        <View className='profile-card motion-enter'>
          <View
            className='profile-card__avatar'
            ariaRole='button'
            ariaLabel={savingAvatar ? '头像正在上传' : '更换头像'}
            onClick={() => void chooseAvatar()}
          >
            <UserAvatarImage
              src={avatarUrl}
              className='profile-card__avatar-image'
              fallback={displayName.slice(0, 1)}
            />
            <Text className='profile-card__avatar-action'>
              {savingAvatar
                ? `${avatarDraft?.progress || 0}%`
                : avatarDraft?.status === 'uploaded' || currentUser?.user.avatar_moderation_status
                  ? '审核中'
                  : '更换'}
            </Text>
            <View className='profile-card__status' />
          </View>
          <View
            className='profile-card__main'
            hoverClass='profile-card__main--pressed'
            ariaRole='button'
            ariaLabel='查看我的公开个人主页'
            onClick={openMyPublicProfile}
          >
            <Text className='profile-card__name'>
              {displayName}
            </Text>
            <Text className='profile-card__school'>
              {accountDescription}
            </Text>
            <Text className='profile-card__public-link'>查看个人主页 ›</Text>
          </View>
          <View className='profile-card__actions'>
            <View
              className={[
                'profile-card__badge',
                identityVerified ? 'profile-card__badge--verified' : '',
                identityPending ? 'profile-card__badge--pending' : '',
              ].filter(Boolean).join(' ')}
              hoverClass='profile-card__badge--pressed'
              ariaRole='button'
              ariaLabel={`校园身份，${identityMeta}`}
              onClick={() => openMenu(identityMenu)}
            >
              <Text>{identityBadgeText}</Text>
              <Image src={icons.arrow} mode='aspectFit' />
            </View>
            <View
              className={[
                'profile-card__checkin',
                checkinStatus?.checked_in ? 'profile-card__checkin--done' : '',
              ].filter(Boolean).join(' ')}
              hoverClass='profile-card__checkin--pressed'
              ariaRole='button'
              ariaLabel={checkinStatus?.checked_in ? '今日已签到，查看签到记录' : '前往每日签到'}
              onClick={() => Taro.navigateTo({ url: '/pages/daily-checkin/index' })}
            >
              <View />
              <Text>
                {checkinStatus?.checked_in
                  ? '已签到'
                  : checkinStatus?.enabled === false
                    ? '签到'
                    : '去签到'}
              </Text>
            </View>
          </View>
        </View>

        {avatarDraft?.status === 'failed' && (
          <View className='profile-avatar-error'>
            <Text>{avatarDraft.error}</Text>
            <Text onClick={() => void applyAvatar(avatarDraft)}>重试</Text>
          </View>
        )}

        {userLevel && (
          <View
            className={`profile-level profile-level--${userLevel.theme} motion-enter motion-enter--delay-1`}
            hoverClass='profile-level--pressed'
            ariaRole='button'
            ariaLabel={`社区等级，Lv.${userLevel.level} ${userLevel.name}`}
            onClick={() => Taro.navigateTo({ url: '/pages/user-level/index' })}
          >
            <View className='profile-level__head'>
              <View>
                <Text>社区贡献等级</Text>
                <Text>Lv.{userLevel.level} · {userLevel.name}</Text>
              </View>
              <View className='profile-level__experience'>
                <Text>{userLevel.experience}</Text>
                <Text>经验</Text>
              </View>
            </View>
            <View className='profile-level__track'>
              <View style={{ width: `${Math.max(0, Math.min(100, userLevel.progress_percent))}%` }} />
            </View>
            <View className='profile-level__foot'>
              <Text>{userLevel.description}</Text>
              <Text>
                {userLevel.is_max_level
                  ? '已达最高等级'
                  : `还差 ${userLevel.experience_to_next} 经验升级`}
              </Text>
            </View>
          </View>
        )}

        <View className='profile-section motion-enter motion-enter--delay-2'>
          <View className='profile-section__head'>
            <Text className='profile-section__title'>我的服务</Text>
            <Text className='profile-section__hint'>常用记录，一步直达</Text>
          </View>
          <View className='profile-menu'>
            {visibleMenus.map((item) => (
              <View
                key={item.key}
                className={`profile-menu__item profile-menu__item--${item.key}`}
                hoverClass='profile-menu__item--pressed'
                ariaRole='button'
                ariaLabel={item.name}
                onClick={() => openMenu(item)}
              >
                <View className='profile-menu__icon'>
                  <Image src={item.icon} mode='aspectFit' />
                </View>
                <Text>{item.name}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className='profile-section motion-enter motion-enter--delay-3'>
          <Text className='profile-section__title'>账号与身份</Text>
          <View className='profile-account-list'>
            <View
              className='profile-identity-entry'
              hoverClass='profile-identity-entry--pressed'
              ariaRole='button'
              ariaLabel={`编辑昵称，当前为${currentUser?.user.username || '加载中'}`}
              onClick={beginUsernameEdit}
            >
              <View className='profile-identity-entry__icon'>
                <Image src={icons.account} mode='aspectFit' />
              </View>
              <View className='profile-identity-entry__main'>
                <Text>昵称</Text>
                <Text>{currentUser?.user.username || (accountLoaded ? '点击重试' : '加载中')}</Text>
              </View>
              <Image
                className='profile-identity-entry__arrow'
                src={icons.arrow}
                mode='aspectFit'
              />
            </View>

            {editingUsername && (
              <View className='profile-username-editor'>
                <View className='profile-username-editor__field'>
                  <KeyboardSafeInput
                    value={usernameDraft}
                    maxlength={USERNAME_MAX_LENGTH}
                    confirmType='done'
                    focus
                    placeholder='输入 2–32 个字符'
                    onInput={(event) => setUsernameDraft(event.detail.value)}
                    onConfirm={() => void saveUsername()}
                  />
                  <Text>{normalizeUsername(usernameDraft).length}/{USERNAME_MAX_LENGTH}</Text>
                </View>
                <Text className='profile-username-editor__hint'>
                  支持中文、字母、数字、点、下划线和短横线，社区内容将同步展示新昵称。
                </Text>
                <View className='profile-username-editor__actions'>
                  <View
                    className='profile-username-editor__cancel'
                    ariaRole='button'
                    ariaLabel='取消修改昵称'
                    onClick={cancelUsernameEdit}
                  >
                    <Text>取消</Text>
                  </View>
                  <View
                    className={[
                      'profile-username-editor__save',
                      savingUsername ? 'profile-username-editor__save--disabled' : '',
                    ].filter(Boolean).join(' ')}
                    ariaRole='button'
                    ariaLabel={savingUsername ? '正在保存昵称' : '保存昵称'}
                    onClick={() => void saveUsername()}
                  >
                    <Text>{savingUsername ? '保存中' : '保存'}</Text>
                  </View>
                </View>
              </View>
            )}

            <View
              className='profile-identity-entry'
              hoverClass='profile-identity-entry--pressed'
              ariaRole='button'
              ariaLabel={`校园身份，${identityMeta}`}
              onClick={() => openMenu(identityMenu)}
            >
              <View className='profile-identity-entry__icon'>
                <Image src={identityMenu.icon} mode='aspectFit' />
              </View>
              <View className='profile-identity-entry__main'>
                <Text>{identityMenu.name}</Text>
                <Text>{identityMeta}</Text>
              </View>
              <Image
                className='profile-identity-entry__arrow'
                src={icons.arrow}
                mode='aspectFit'
              />
            </View>

            <View
              className='profile-identity-entry'
              hoverClass='profile-identity-entry--pressed'
              ariaRole='button'
              ariaLabel='查看小程序用户隐私保护指引'
              onClick={() => void openPrivacy()}
            >
              <View className='profile-identity-entry__icon profile-identity-entry__icon--privacy'>
                <Image src={icons.privacy} mode='aspectFit' />
              </View>
              <View className='profile-identity-entry__main'>
                <Text>隐私保护指引</Text>
                <Text>查看微信官方隐私协议</Text>
              </View>
              <Image
                className='profile-identity-entry__arrow'
                src={icons.arrow}
                mode='aspectFit'
              />
            </View>

            <View
              className='profile-identity-entry profile-identity-entry--danger'
              hoverClass='profile-identity-entry--pressed'
              ariaRole='button'
              ariaLabel='注销当前账号'
              onClick={() => Taro.navigateTo({ url: '/pages/account-cancellation/index' })}
            >
              <View className='profile-identity-entry__icon'>
                <Image src={icons.account} mode='aspectFit' />
              </View>
              <View className='profile-identity-entry__main'>
                <Text>注销账号</Text>
                <Text>匿名化账号并解绑教务</Text>
              </View>
              <Image
                className='profile-identity-entry__arrow'
                src={icons.arrow}
                mode='aspectFit'
              />
            </View>
          </View>
        </View>
      </View>
    </View>
  )
}
