import { useCallback, useEffect, useRef, useState } from 'react'
import Taro, { useDidHide, useDidShow } from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import UserAvatar from '../../components/user-avatar'
import { KeyboardSafeInput } from '../../components/keyboard-safe-input'
import { getCurrentUser, updateCurrentAvatar, updateCurrentUsername } from '../../api/account'
import { getAcademicVerificationStatus } from '../../api/academic-verification'
import { isApiError } from '../../api/client'
import { getMedia, uploadMediaImage } from '../../api/media'
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
import {
  AVATAR_MODERATION_MAX_NETWORK_FAILURES,
  AVATAR_MODERATION_MAX_POLLS,
  avatarModerationStorage,
  avatarModerationPollDelay,
  canRetryApprovedAvatarRefresh,
  isAvatarModerationUserId,
  resolveApprovedAvatarRefresh,
  resolveAvatarModerationOutcome,
} from '../../features/profile/avatar-moderation'
import { isQualificationEdition } from '../../features/app-edition'
import {
  AVATAR_IMAGE_MAX_DIMENSION,
  AVATAR_IMAGE_QUALITY,
} from '../../features/media/images'
import type { MediaImageDraft } from '../../features/media/images'
import { chooseMediaImages } from '../../features/media/selection'
import { syncCustomTabBar } from '../../utils/tabbar'
import { showActionSheetSelection } from '../../utils/action-sheet'
import { openPublicProfile } from '../../features/profile/public-profile'
import {
  getCampusThemePreference,
  restartWithCampusThemePreference,
  subscribeCampusTheme,
  type CampusThemePreference,
} from '../../features/theme-preference'
import './index.scss'

const icons = {
  arrow: require('../../assets/icons/arrow.svg'),
  schedule: require('../../assets/icons/calendar.svg'),
  materials: require('../../assets/icons/materials.svg'),
  published: require('../../assets/icons/community.svg'),
  accepted: require('../../assets/icons/errands.svg'),
  orders: require('../../assets/icons/market.svg'),
  carpool: require('../../assets/icons/shuttle.svg'),
  favorites: require('../../assets/community/bookmark.svg'),
  identity: require('../../assets/icons/academic.svg'),
  privacy: require('../../assets/icons/study.svg'),
  account: require('../../assets/icons/profile.svg'),
  theme: require('../../assets/icons/theme.svg'),
}

const themePreferenceOptions: Array<{
  label: string
  value: CampusThemePreference
}> = [
  { label: '跟随系统', value: 'system' },
  { label: '打开', value: 'dark' },
  { label: '关闭', value: 'light' },
]

const themePreferenceLabels: Record<CampusThemePreference, string> = {
  system: '跟随系统',
  dark: '打开',
  light: '关闭',
}

const menus = [
  {
    key: 'schedule',
    name: '课表',
    icon: icons.schedule,
    route: '/pages/academic/schedule/index',
  },
  {
    key: 'materials',
    name: '资料',
    icon: icons.materials,
    route: '/pages/materials/index?view=mine',
  },
  {
    key: 'published',
    name: '发布',
    icon: icons.published,
    route: '/packages/social/my-services/index?section=published',
  },
  {
    key: 'accepted',
    name: '接单',
    icon: icons.accepted,
    route: '/packages/social/my-services/index?section=errands&relation=accepted',
  },
  {
    key: 'orders',
    name: '订单',
    icon: icons.orders,
    route: '/packages/social/my-services/index?section=orders&relation=all',
  },
  {
    key: 'carpool',
    name: '同行',
    icon: icons.carpool,
    route: '/packages/social/my-services/index?section=carpool&relation=all',
  },
  {
    key: 'favorites',
    name: '收藏',
    icon: icons.favorites,
    route: '/pages/favorites/index',
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

type AvatarModerationNotice = 'reviewing' | 'unavailable' | 'rejected'
type PendingAvatarModeration = {
  mediaId: number
  userId: number
}
type AvatarModerationOperation = PendingAvatarModeration & {
  version: number
}
type AvatarUploadOperation = {
  draftKey: string
  userId: number
  version: number
}

const avatarModerationNoticeCopy: Record<AvatarModerationNotice, string> = {
  reviewing: '头像正在审核，审核完成后会自动更新',
  unavailable: '头像审核仍在进行，状态暂时无法刷新，请稍后回到此页查看',
  rejected: '头像审核未通过，请重新选择',
}

export default function ProfilePage() {
  const [themePreference, setThemePreferenceState] = useState<CampusThemePreference>(
    getCampusThemePreference,
  )
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
  const [profileVisible, setProfileVisible] = useState(true)
  const [avatarModerationNotice, setAvatarModerationNotice] = useState<AvatarModerationNotice | null>(null)
  const [pendingAvatarModeration, setPendingAvatarModeration] = useState<PendingAvatarModeration | null>(null)
  const profileVisibleRef = useRef(true)
  const profileShowVersionRef = useRef(0)
  const currentUserIdRef = useRef<number | null>(null)
  const avatarOperationVersionRef = useRef(0)
  const activeAvatarMediaIdRef = useRef<number | null>(null)
  const activeAvatarUserIdRef = useRef<number | null>(null)
  const activeAvatarDraftKeyRef = useRef('')
  const pendingAvatarModerationRef = useRef<PendingAvatarModeration | null>(null)
  const approvedAvatarUrlRef = useRef<string | null>(null)
  const updatePendingAvatarModeration = useCallback((pending: PendingAvatarModeration | null) => {
    pendingAvatarModerationRef.current = pending
    setPendingAvatarModeration(pending)
  }, [])
  const isAvatarOperationLatest = useCallback((operation: AvatarModerationOperation) => (
    avatarOperationVersionRef.current === operation.version
    && activeAvatarMediaIdRef.current === operation.mediaId
    && activeAvatarUserIdRef.current === operation.userId
  ), [])
  const isAvatarOperationCurrent = useCallback((operation: AvatarModerationOperation) => (
    profileVisibleRef.current && isAvatarOperationLatest(operation)
  ), [isAvatarOperationLatest])
  useEffect(() => subscribeCampusTheme((_theme, preference) => {
    setThemePreferenceState(preference)
  }), [])
  const loadCurrentUser = useCallback(async (
    showError = false,
    force = false,
    guard?: () => boolean,
  ) => {
    const canApply = () => profileVisibleRef.current && (!guard || guard())
    if (canApply()) setAccountLoaded(false)
    try {
      const account = await getCurrentUser({ force })
      if (!canApply()) return account
      const userId = account.user.id
      if (currentUserIdRef.current !== null && currentUserIdRef.current !== userId) {
        avatarOperationVersionRef.current += 1
        activeAvatarMediaIdRef.current = null
        activeAvatarUserIdRef.current = null
        activeAvatarDraftKeyRef.current = ''
        approvedAvatarUrlRef.current = null
        updatePendingAvatarModeration(null)
        setAvatarDraft(null)
        setAvatarModerationNotice(null)
        setSavingAvatar(false)
      }
      currentUserIdRef.current = userId
      if (!account.user.avatar_moderation_status || approvedAvatarUrlRef.current === null) {
        approvedAvatarUrlRef.current = userAvatarUrl(account.user)
      }
      setCurrentUser(account)
      setUsernameDraft(account.user.username)
      return account
    } catch {
      if (showError && canApply()) {
        Taro.showToast({ title: '账号信息加载失败，请稍后重试', icon: 'none' })
      }
      return null
    } finally {
      if (canApply()) setAccountLoaded(true)
    }
  }, [updatePendingAvatarModeration])
  useDidShow(() => {
    profileVisibleRef.current = true
    const showVersion = ++profileShowVersionRef.current
    const avatarOperationVersion = avatarOperationVersionRef.current
    setProfileVisible(true)
    setAccountLoaded(false)
    setSavingAvatar(false)
    syncCustomTabBar('profile')
    setCheckinStatus(null)
    void loadCurrentUser().then((account) => {
      if (
        !account
        || !profileVisibleRef.current
        || profileShowVersionRef.current !== showVersion
        || avatarOperationVersionRef.current !== avatarOperationVersion
        || !isAvatarModerationUserId(account.user.id)
      ) return
      const mediaId = avatarModerationStorage.read(Taro, account.user.id)
      if (!mediaId) return
      const restored: PendingAvatarModeration = { mediaId, userId: account.user.id }
      const currentPending = pendingAvatarModerationRef.current
      if (currentPending?.mediaId === mediaId && currentPending.userId === account.user.id) return
      updatePendingAvatarModeration(restored)
      setAvatarDraft(null)
      setAvatarModerationNotice('reviewing')
    })
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
  useDidHide(() => {
    profileVisibleRef.current = false
    profileShowVersionRef.current += 1
    setProfileVisible(false)
  })
  useEffect(() => () => {
    profileVisibleRef.current = false
    profileShowVersionRef.current += 1
  }, [])
  useEffect(() => {
    if (!profileVisible || !pendingAvatarModeration) {
      return undefined
    }

    const operation: AvatarModerationOperation = {
      ...pendingAvatarModeration,
      version: avatarOperationVersionRef.current + 1,
    }
    avatarOperationVersionRef.current = operation.version
    activeAvatarMediaIdRef.current = operation.mediaId
    activeAvatarUserIdRef.current = operation.userId
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let pollCount = 0
    let networkFailureCount = 0
    let approvedRefreshFailureCount = 0
    const stop = () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
    const scheduleNext = (failureCount = networkFailureCount) => {
      if (cancelled || !isAvatarOperationCurrent(operation)) return
      timer = setTimeout(() => {
        void poll()
      }, avatarModerationPollDelay(failureCount))
    }
    const poll = async () => {
      if (cancelled || !isAvatarOperationCurrent(operation)) return
      pollCount += 1
      try {
        const media = await getMedia(operation.mediaId)
        if (cancelled || !isAvatarOperationCurrent(operation)) return
        networkFailureCount = 0
        const outcome = resolveAvatarModerationOutcome(media.moderation_status)
        if (outcome === 'approved') {
          const refreshedAccount = await loadCurrentUser(
            false,
            true,
            () => isAvatarOperationCurrent(operation),
          )
          const refreshResolution = resolveApprovedAvatarRefresh(
            Boolean(refreshedAccount),
            isAvatarOperationCurrent(operation),
          )
          if (refreshResolution === 'ignore') return
          if (refreshResolution === 'retry') {
            approvedRefreshFailureCount += 1
            setAvatarModerationNotice('unavailable')
            if (!canRetryApprovedAvatarRefresh(approvedRefreshFailureCount, pollCount)) return
            scheduleNext(approvedRefreshFailureCount)
            return
          }
          avatarModerationStorage.remove(Taro, operation.userId)
          updatePendingAvatarModeration(null)
          setAvatarDraft((currentDraft) => currentDraft?.mediaId === operation.mediaId ? null : currentDraft)
          setAvatarModerationNotice(null)
          activeAvatarMediaIdRef.current = null
          return
        }
        approvedRefreshFailureCount = 0
        if (outcome === 'rejected') {
          avatarModerationStorage.remove(Taro, operation.userId)
          updatePendingAvatarModeration(null)
          setAvatarDraft((currentDraft) => currentDraft?.mediaId === operation.mediaId ? null : currentDraft)
          setCurrentUser((account) => account ? {
            ...account,
            user: {
              ...account.user,
              avatar_url: approvedAvatarUrlRef.current ?? account.user.avatar_url,
              avatar_moderation_status: null,
            },
          } : account)
          setAvatarModerationNotice('rejected')
          Taro.showToast({ title: avatarModerationNoticeCopy.rejected, icon: 'none' })
          void loadCurrentUser(false, true, () => isAvatarOperationCurrent(operation)).then(() => {
            if (isAvatarOperationCurrent(operation)) activeAvatarMediaIdRef.current = null
          })
          return
        }
      } catch {
        if (cancelled || !isAvatarOperationCurrent(operation)) return
        networkFailureCount += 1
      }

      if (cancelled || !isAvatarOperationCurrent(operation)) return
      if (
        pollCount >= AVATAR_MODERATION_MAX_POLLS
        || networkFailureCount >= AVATAR_MODERATION_MAX_NETWORK_FAILURES
      ) {
        setAvatarModerationNotice('unavailable')
        return
      }
      scheduleNext()
    }

    void poll()
    return stop
  }, [
    isAvatarOperationCurrent,
    loadCurrentUser,
    pendingAvatarModeration,
    profileVisible,
    updatePendingAvatarModeration,
  ])
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
    const account = currentUser
    const userId = account?.user.id
    if (!accountLoaded || !account || !isAvatarModerationUserId(userId)) {
      Taro.showToast({ title: '账号信息加载中，请稍后重试', icon: 'none' })
      void loadCurrentUser(true)
      return
    }
    if (approvedAvatarUrlRef.current === null) approvedAvatarUrlRef.current = userAvatarUrl(account.user)
    const operation: AvatarUploadOperation = {
      draftKey: draft.key,
      userId,
      version: avatarOperationVersionRef.current + 1,
    }
    avatarOperationVersionRef.current = operation.version
    activeAvatarMediaIdRef.current = null
    activeAvatarUserIdRef.current = operation.userId
    activeAvatarDraftKeyRef.current = operation.draftKey
    avatarModerationStorage.remove(Taro, operation.userId)
    updatePendingAvatarModeration(null)
    const isLatest = () => (
      avatarOperationVersionRef.current === operation.version
      && activeAvatarUserIdRef.current === operation.userId
      && activeAvatarDraftKeyRef.current === operation.draftKey
    )
    const isCurrent = () => profileVisibleRef.current && isLatest()
    setSavingAvatar(true)
    setAvatarModerationNotice(null)
    setAvatarDraft({ ...draft, status: 'uploading', error: '' })
    try {
      const mediaId = draft.mediaId || (await uploadMediaImage({
        purpose: 'avatar',
        filePath: draft.localPath,
        mimeType: draft.mimeType,
        sizeBytes: draft.sizeBytes,
        onProgress: (progress) => setAvatarDraft((currentDraft) => (
          isCurrent() && currentDraft?.key === draft.key
            ? { ...currentDraft, status: 'uploading', progress }
            : currentDraft
        )),
      })).id
      if (!isLatest()) return
      const updated = await updateCurrentAvatar(mediaId)
      if (!isLatest()) return
      activeAvatarMediaIdRef.current = mediaId
      avatarModerationStorage.write(Taro, operation.userId, mediaId)
      if (!isCurrent()) return
      setCurrentUser((loadedAccount) => (
        loadedAccount?.user.id === operation.userId
          ? { ...loadedAccount, user: updated }
          : loadedAccount
      ))
      setAvatarDraft((currentDraft) => currentDraft?.key === draft.key
        ? { ...currentDraft, mediaId, status: 'uploaded', progress: 100, error: '' }
        : currentDraft)
      updatePendingAvatarModeration({ mediaId, userId: operation.userId })
      setAvatarModerationNotice('reviewing')
      Taro.showToast({ title: '头像审核中', icon: 'none' })
    } catch (error) {
      if (!isCurrent()) return
      setAvatarDraft((currentDraft) => currentDraft?.key === draft.key
        ? {
          ...currentDraft,
          status: 'failed',
          error: isApiError(error) ? error.message : '头像更新失败，请重试',
        }
        : currentDraft)
    } finally {
      if (isCurrent()) setSavingAvatar(false)
    }
  }
  const chooseAvatar = async () => {
    if (savingAvatar) return
    if (!accountLoaded || !currentUser || !isAvatarModerationUserId(currentUser.user.id)) {
      Taro.showToast({ title: '账号信息加载中，请稍后重试', icon: 'none' })
      void loadCurrentUser(true)
      return
    }
    try {
      const [selected] = await chooseMediaImages({
        count: 1,
        cropSquare: true,
        maxDimension: AVATAR_IMAGE_MAX_DIMENSION,
        quality: AVATAR_IMAGE_QUALITY,
      })
      if (!selected) return
      setAvatarModerationNotice(null)
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
  const avatarReviewing = Boolean(pendingAvatarModeration)
    || avatarDraft?.status === 'uploaded'
    || Boolean(currentUser?.user.avatar_moderation_status)
  const openMyPublicProfile = () => {
    if (!currentUser) {
      Taro.showToast({ title: accountLoaded ? '账号信息加载失败' : '账号信息加载中', icon: 'none' })
      return
    }
    void openPublicProfile(currentUser.user.id)
  }
  const chooseCampusTheme = async () => {
    const selectedIndex = await showActionSheetSelection(
      themePreferenceOptions.map((option) => option.label),
    )
    if (selectedIndex === null) return
    const nextPreference = themePreferenceOptions[selectedIndex]?.value
    if (!nextPreference || nextPreference === themePreference) return
    restartWithCampusThemePreference(nextPreference)
  }

  return (
    <View className='profile-page'>
      <CustomNavbar title='我的' />

      <View className='profile-page__content'>
        <View className='profile-card motion-enter'>
          <UserAvatar
            src={avatarUrl}
            className='profile-card__avatar'
            imageClassName='profile-card__avatar-image'
            fallback={displayName.slice(0, 1)}
            userId={currentUser?.user.id}
            ariaRole='button'
            ariaLabel={savingAvatar ? '头像正在上传' : avatarReviewing ? '头像审核中' : '更换头像'}
            onClick={() => void chooseAvatar()}
          >
            <Text className='profile-card__avatar-action'>
              {savingAvatar
                ? `${avatarDraft?.progress || 0}%`
                : avatarReviewing
                  ? '审核中'
                  : '更换'}
            </Text>
            <View className='profile-card__status' />
          </UserAvatar>
          <View
            className='profile-card__main'
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

        {avatarModerationNotice && (
          <View
            className={[
              'profile-avatar-notice',
              `profile-avatar-notice--${avatarModerationNotice}`,
            ].join(' ')}
            ariaRole='alert'
          >
            <Text>{avatarModerationNoticeCopy[avatarModerationNotice]}</Text>
            {avatarModerationNotice === 'rejected' && (
              <View
                className='profile-avatar-notice__action'
                ariaRole='button'
                ariaLabel='重新选择头像'
                onClick={() => void chooseAvatar()}
              >
                <Text>重新选择</Text>
              </View>
            )}
          </View>
        )}

        {userLevel && (
          <View
            className={`profile-level profile-level--${userLevel.theme} motion-enter motion-enter--delay-1`}
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
            <View className='profile-section__heading'>
              <View className='profile-section__heading-bar' />
              <Text className='profile-section__title'>我的服务</Text>
            </View>
            <Text className='profile-section__hint'>常用记录，一步直达</Text>
          </View>
          <View className='profile-menu'>
            {visibleMenus.map((item) => (
              <View
                key={item.key}
                className={`profile-menu__item profile-menu__item--${item.key}`}
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
          <View className='profile-section__heading profile-section__heading--standalone'>
            <View className='profile-section__heading-bar' />
            <Text className='profile-section__title'>显示与外观</Text>
          </View>
          <View className='profile-account-list'>
            <View
              className='profile-identity-entry profile-theme-entry'
              ariaRole='button'
              ariaLabel={`深色模式，当前${themePreferenceLabels[themePreference]}`}
              onClick={() => void chooseCampusTheme()}
            >
              <View className='profile-identity-entry__icon profile-theme-entry__icon'>
                <Image src={icons.theme} mode='aspectFit' />
              </View>
              <View className='profile-identity-entry__main'>
                <Text>深色模式</Text>
                <Text>选择跟随系统或手动设置</Text>
              </View>
              <Text className='profile-theme-entry__value'>
                {themePreferenceLabels[themePreference]}
              </Text>
              <Image
                className='profile-identity-entry__arrow'
                src={icons.arrow}
                mode='aspectFit'
              />
            </View>
          </View>
        </View>

        <View className='profile-section motion-enter motion-enter--delay-3'>
          <View className='profile-section__heading profile-section__heading--standalone'>
            <View className='profile-section__heading-bar' />
            <Text className='profile-section__title'>账号与身份</Text>
          </View>
          <View className='profile-account-list'>
            <View
              className='profile-identity-entry'
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
