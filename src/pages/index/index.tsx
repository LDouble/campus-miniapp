import { useCallback, useEffect, useRef, useState } from 'react'
import Taro, {
  useDidShow,
  usePageScroll,
  usePullDownRefresh,
  useReachBottom,
} from '@tarojs/taro'
import {
  Image,
  Swiper,
  SwiperItem,
  Text,
  View,
} from '@tarojs/components'
import { getCachedPageUser, getCachedPageUserId, getPageCacheScope, subscribePageCacheScope } from '../../state/page-cache'
import { homeCacheKey, readHomeSnapshot, updateHomeSnapshot, refreshHomeSection } from '../../features/home/page-cache'

import { getLifeHubRefreshRevision, markLifeHubSectionDirty } from '../../features/life-services/refresh-policy'
import { allServices, serviceModules as serviceModuleKeys, migratedServiceKeys as migratedHomeServiceKeys } from '../../features/service-shortcuts/catalog'
import { readShortcuts } from '../../features/service-shortcuts/preferences'
import { openService as openCustomService } from '../../features/service-shortcuts/navigation'
import { getServiceIcon } from '../../features/service-shortcuts/icons'
import { useViewPageVisible } from '../../features/community/use-view-page-visible'
import TodayHotHomeEntry from '../../features/today-hot/home-entry'
import { useCampusLocationPrompt } from '../../features/campus-location/use-campus-location-prompt'
import { getCurrentUser } from '../../api/account'
import { getAcademicVerificationStatus } from '../../api/academic-verification'
import { createDailyCheckin, getMyDailyCheckinStatus } from '../../api/daily-checkins'
import { isApiError } from '../../api/client'
import { listMyUserLevelTasks } from '../../api/user-levels'
import {
  deleteMyCalendarReminder,
  listMyCalendarReminders,
  putMyCalendarReminder,
} from '../../api/calendar-reminders'
import { isAccountCancelled } from '../../api/auth'
import {
  hasAcademicCredential,
} from '../../api/academic-credential'
import type {
  CommentView,
  HomeFeedItemView,
  CalendarReminderView,
  DailyCheckinStatus,
  UserLevelTask,
} from '../../api/types'
import CustomNavbar from '../../components/custom-navbar'
import BottomSheet from '../../components/bottom-sheet'
import UserAvatar from '../../components/user-avatar'
import CommunityCommentSheet from '../../features/community/comment-sheet'
import CommunityPostCard, { type CommunityPostCommentPreview } from '../../features/community/post-card'
import { mergePublicCommentPreview } from '../../features/community/comments'
import { useDismissCommunityOverlaysOnScroll } from '../../features/community/use-overlay-dismissal'
import { showActionSheetSelection } from '../../utils/action-sheet'
import { isQualificationEdition } from '../../features/app-edition'
import { openMigratedFeaturePage } from '../../features/app-edition/navigation'
import { openClassDiscussion } from '../../features/class-discussion/navigation'
import { type ClassQuickQuestionId } from '../../features/class-discussion/topic'
import scheduleCalendarArrowIcon from '../../assets/icons/home-schedule-calendar-arrow.svg'
import allServicesIcon from '../../assets/icons/home-services-all.svg'
import HomeCourseCarousel from '../../features/home/course-carousel'
import {
  avatarText,
  resolveCoursePreview,
  tomorrowStartingPeriod,
} from '../../features/home/data'
import {
  homeFeedItemToPost,
  homeFeedBusinessPreview,
  homeFeedKey,
  sourceLabels as homeFeedSourceLabels,
} from '../../features/home/feed-post-adapter'
import { formatHomeMomentsTime } from '../../features/home/moments'
import { officialNoticesRepository } from '../../features/official-notices/repository'
import { noticesRepository } from '../../features/notices/repository'
import { refreshPrivateMessageUnreadCount } from '../../features/direct-messages/unread'
import {
  readHomeNotificationGuideRecord,
  resolveHomeNotificationTemplateIds,
  saveHomeNotificationGuideRecord,
  shouldShowHomeNotificationGuide,
} from '../../features/home/notification-guide'
import {
  getWechatSubscriptionSettings,
  openWechatSubscriptionSettings,
} from '../../features/wechat-subscription/request'
import {
  officialNoticeSourceLabels,
} from '../../features/official-notices/types'
import type { OfficialNotice } from '../../features/official-notices/types'
import {
  activeBanners,
  activeSlogans,
  enabledCampuses,
  getMigrationGuideCopy,
  getMiniappRuntimeConfig,
  getSelectedCampus,
  loadMiniappRuntimeConfig,
  MiniappRuntimeConfig,
  MiniappModuleKey,
  openMiniappModule,
  resolveMiniappModule,
  RuntimeBanner,
  saveSelectedCampus,
} from '../../features/runtime-config'
import { useCollapsingHeader } from '../../hooks/use-collapsing-header'
import { useLoadMoreSignal } from '../../hooks/use-load-more-signal'
import { academicRepository } from '../academic/repository'
import {
  requireCoursesForPeriod,
  setCoursesForPeriod,
} from '../academic/schedule-courses'
import {
  academicStorage,
  type AcademicScheduleCache,
} from '../academic/storage'
import {
  getAcademicCalendarLabel,
  getCurrentAcademicWeek,
  resolveScheduleAnchor,
} from '../academic/utils'
import { normalizeWebViewUrl } from '../../features/webview/url'
import {
  calendarEventDateLabel,
  resolveTodayTask,
  upcomingHomeCalendarEvents,
} from '../../features/home/today'
import {
  getCalendarEducationLevel,
  getCachedAcademicCalendar,
  loadAcademicCalendar,
} from '../../features/calendar/repository'
import { setCustomTabBarHidden, syncCustomTabBar } from '../../utils/tabbar'
import { useCampusShare } from '../../features/share'
import {
  getCampusTheme,
  subscribeCampusTheme,
  type CampusTheme,
} from '../../features/system-theme'
import './index.scss'
import './course-home.scss'

const fullLifeServicesRepository = __CAMPUS_APP_EDITION__ === 'qualification'
  ? null
  : require('../../features/life-services/repository').lifeServicesRepository as typeof import('../../features/life-services/repository').lifeServicesRepository

const icons = {
  academic: require('../../assets/icons/academic.svg'),
  community: require('../../assets/icons/community.svg'),
  market: require('../../assets/icons/market.svg'),
  errands: require('../../assets/icons/errands.svg'),
  calendar: require('../../assets/icons/calendar.svg'),
  grade: require('../../assets/icons/grade.svg'),
  exam: require('../../assets/icons/exam.svg'),
  result: require('../../assets/icons/result.svg'),
  passRate: require('../../assets/icons/pass-rate.svg'),
  materials: require('../../assets/icons/materials.svg'),
  shuttle: require('../../assets/icons/shuttle.svg'),
  location: require('../../assets/icons/location.svg'),
  arrow: require('../../assets/icons/arrow.svg'),
  check: require('../../assets/icons/check-circle.svg'),
  clubs: require('../../assets/icons/clubs.svg'),
  whatToEat: require('../../assets/icons/what-to-eat.svg'),
  arrowUp: require('../../assets/icons/arrow-up.svg'),
}

// 首页服务入口使用预着色的 SDR SVG，避免微信 iOS 为 CSS filter 创建原生图像合成层。
const homeFeatureFlags = { todayTask: false, campusRecommendation: false } as const

const HOME_COURSE_PREVIEW_LIMIT = 8

const lifeSectionModules: Record<LifeHubSection, MiniappModuleKey> = {
  community: 'community',
  errands: 'errand',
  market: 'marketplace',
  carpool: 'carpool',
}

const HOME_FEED_PAGE_SIZE = 8
const homeFeedSourceModules: Record<HomeFeedItemView['source_type'], MiniappModuleKey> = {
  campus_circle_post: 'community',
  marketplace_listing: 'marketplace',
  errand: 'errand',
  carpool: 'carpool',
}

const enabledHomeFeedItems = (
  items: HomeFeedItemView[],
  config: MiniappRuntimeConfig,
) => items.filter((item) => (
  resolveMiniappModule(config, homeFeedSourceModules[item.source_type]).state === 'enabled'
))

const mergeHomeFeedItems = (
  current: HomeFeedItemView[],
  incoming: HomeFeedItemView[],
) => {
  const byKey = new Map(current.map((item) => [homeFeedKey(item), item]))
  incoming.forEach((item) => {
    const currentItem = byKey.get(homeFeedKey(item))
    byKey.set(homeFeedKey(item), currentItem
      ? {
          ...item,
          comment_count: Math.max(currentItem.comment_count, item.comment_count),
          comment_previews: currentItem.comment_previews.length
            ? currentItem.comment_previews
            : item.comment_previews,
        }
      : item)
  })
  return [...byKey.values()]
}
const LIFE_HUB_SECTION_KEY = 'campus.lifeHub.section.v1'
type LifeHubSection = 'community' | 'errands' | 'market' | 'carpool'

type Settled<T> = { ok: true; value: T } | { ok: false }
const settle = async <T,>(promise: Promise<T>): Promise<Settled<T>> => {
  try {
    return { ok: true, value: await promise }
  } catch {
    return { ok: false }
  }
}

const loadCachedCoursePreview = (
  config: MiniappRuntimeConfig,
  campusName: string,
) => {
  const userId = getCachedPageUserId()
  return resolveCoursePreview(
    academicStorage.getScheduleCache(userId),
    academicStorage.getCustomCourses(getCachedPageUserId()),
    config,
    campusName,
    new Date(),
    HOME_COURSE_PREVIEW_LIMIT,
  )
}

const loadCachedAcademicLabel = () => {
  const cache = academicStorage.getScheduleCache(getCachedPageUserId())
  return getAcademicCalendarLabel(cache?.periods || [])
}

const loadLatestAcademic = async (
  userId: number,
  cache: AcademicScheduleCache | null,
  force = false,
  isCurrent: () => boolean = () => true,
) => {
  const periodsResult = await settle(academicRepository.getPeriods({ force }))
  if (!isCurrent() || !periodsResult.ok) return cache
  cache = academicStorage.getScheduleCache(userId) || cache

  const periods = periodsResult.value
  let coursesByPeriod = cache ? cache.coursesByPeriod : {}
  let coursesUpdatedAtByPeriod = cache?.coursesUpdatedAtByPeriod || {}
  let scheduleNotesByPeriod = cache?.scheduleNotesByPeriod || {}
  academicStorage.setScheduleCache(
    userId,
    periods,
    coursesByPeriod,
    coursesUpdatedAtByPeriod,
    scheduleNotesByPeriod,
  )

  const startingTomorrow = tomorrowStartingPeriod(periods)
  const periodId = startingTomorrow?.id || resolveScheduleAnchor(periods).periodId
  const anchoredPeriod = periods.find((period) => period.id === periodId)
  const isCurrentPeriod = !!anchoredPeriod
    && getCurrentAcademicWeek([anchoredPeriod]) !== null
  const hasCredential = hasAcademicCredential(userId)

  if (periodId && (isCurrentPeriod || startingTomorrow) && hasCredential) {
    const coursesResult = await settle(academicRepository.getCourses(periodId))
    if (isCurrent() && coursesResult.ok) {
      const latest = academicStorage.getScheduleCache(userId)
      coursesByPeriod = latest?.coursesByPeriod || coursesByPeriod
      coursesUpdatedAtByPeriod = latest?.coursesUpdatedAtByPeriod || coursesUpdatedAtByPeriod
      scheduleNotesByPeriod = latest?.scheduleNotesByPeriod || scheduleNotesByPeriod
      try {
        const updatedAt = Date.now()
        coursesByPeriod = setCoursesForPeriod(
          coursesByPeriod,
          periodId,
          requireCoursesForPeriod(coursesResult.value.records, periodId),
        )
        coursesUpdatedAtByPeriod = {
          ...coursesUpdatedAtByPeriod,
          [periodId]: updatedAt,
        }
        scheduleNotesByPeriod = {
          ...scheduleNotesByPeriod,
          [periodId]: coursesResult.value.scheduleNote ?? '',
        }
        academicStorage.setScheduleCache(
          userId,
          periods,
          coursesByPeriod,
          coursesUpdatedAtByPeriod,
          scheduleNotesByPeriod,
        )
      } catch {
        // 串学期响应不得污染首页课表缓存；课表页会继续提供显式重试入口。
      }
    }
  }

  return {
    version: 1,
    platformUserId: userId,
    periods,
    coursesByPeriod,
    coursesUpdatedAtByPeriod,
    scheduleNotesByPeriod,
  } satisfies AcademicScheduleCache
}

const loadHomeAcademic = async (
  accountPromise: Promise<Settled<Awaited<ReturnType<typeof getCurrentUser>>>>,
  force = false,
  isCurrent: () => boolean = () => true,
) => {
  const account = await accountPromise
  const userId = account.ok ? account.value.user.id : getCachedPageUserId()
  const cache = academicStorage.getScheduleCache(userId)
  if (!isCurrent() || !account.ok) return cache

  const verification = await settle(getAcademicVerificationStatus({ force }))
  if (!isCurrent() || !verification.ok || verification.value.identity?.status !== 'verified') return cache
  return loadLatestAcademic(userId, cache, force, isCurrent)
}

function Index() {
  const [scope, setScope] = useState(getPageCacheScope)
  useEffect(() => subscribePageCacheScope(() => setScope(getPageCacheScope())), [])
  return <IndexContent key={scope} />
}

function IndexContent() {
  const [initialSnapshot] = useState(readHomeSnapshot)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; setCustomTabBarHidden(false) }
  }, [])
  const [shortcutKeys, setShortcutKeys] = useState(readShortcuts)
  const viewPageVisible = useViewPageVisible()
  useCampusShare((event) => {
    const target = event.target as {
      dataset?: Record<string, string | number>
    } | undefined
    const dataset = target?.dataset || {}
    const postId = Number(dataset.postId)
    const shareTitle = typeof dataset.shareTitle === 'string'
      ? dataset.shareTitle
      : 'OUSea社区'
    const shareImage = typeof dataset.shareImage === 'string'
      ? dataset.shareImage
      : ''
    const result = {
      title: postId > 0 ? shareTitle : 'OUSea｜一站式校园生活',
      path: postId > 0 ? '/pages/community/detail' : '/pages/index/index',
      query: postId > 0 ? { id: postId, mode: 'post' } : undefined,
    }
    return shareImage ? { ...result, imageUrl: shareImage } : result
  })

  const [runtimeConfig, setRuntimeConfig] = useState(getMiniappRuntimeConfig)
  const [campusTheme, setCampusTheme] = useState<CampusTheme>(getCampusTheme)
  const [campusName, setCampusName] = useState(() => (
    getSelectedCampus(getMiniappRuntimeConfig())
  ))
  const [username, setUsername] = useState(() => getCachedPageUser()?.username || '')
  const [avatarUrl, setAvatarUrl] = useState(() => getCachedPageUser()?.avatar_url || '')
  const [avatarUserId, setAvatarUserId] = useState(getCachedPageUserId)
  const [homeFeedItems, setHomeFeedItems] = useState<HomeFeedItemView[]>(() => enabledHomeFeedItems(initialSnapshot.feed?.items || [], getMiniappRuntimeConfig()))
  const [homeFeedPage, setHomeFeedPage] = useState(initialSnapshot.feed?.page || 1)
  const [homeFeedTotal, setHomeFeedTotal] = useState(initialSnapshot.feed?.total || 0)
  const [homeFeedLoadingMore, setHomeFeedLoadingMore] = useState(false)
  const [homeFeedLoadMoreError, setHomeFeedLoadMoreError] = useState(false)
  const [homeFeedRefreshing, setHomeFeedRefreshing] = useState(false)
  const [homeFeedLoadMoreSignal, setHomeFeedLoadMoreSignal] = useState(0)
  const [showHomeBackTop, setShowHomeBackTop] = useState(false)
  const [homeCommentItem, setHomeCommentItem] = useState<HomeFeedItemView | null>(null)
  const [homeCommentReplyTarget, setHomeCommentReplyTarget] = useState<CommunityPostCommentPreview | null>(null)
  const [homeCommentSubmitting, setHomeCommentSubmitting] = useState(false)
  const [openHomeActionKey, setOpenHomeActionKey] = useState<string | null>(null)

  useEffect(() => subscribeCampusTheme((theme) => setCampusTheme(theme)), [])
  const [homeReactions, setHomeReactions] = useState<Record<string, {
    liked: boolean
    likeCount: number
    likedByNicknames: string[]
  }>>({})
  const [commentDismissSignal, setCommentDismissSignal] = useState(0)
  const [noticesError, setNoticesError] = useState(false)
  const [noticesLoading, setNoticesLoading] = useState(!initialSnapshot.notices)
  const [officialNotices, setOfficialNotices] = useState<OfficialNotice[]>(initialSnapshot.notices || [])
  const [calendar, setCalendar] = useState<Awaited<ReturnType<typeof loadAcademicCalendar>>['calendar']>(() => getCachedAcademicCalendar().calendar)
  const [calendarReminders, setCalendarReminders] = useState<CalendarReminderView[]>(initialSnapshot.reminders || [])
  const [dailyCheckin, setDailyCheckin] = useState<DailyCheckinStatus | null>(initialSnapshot.checkin || null)
  const [homeCheckinSubmitting, setHomeCheckinSubmitting] = useState(false)
  const [showNotificationGuide, setShowNotificationGuide] = useState(false)
  const [notificationGuideUserId, setNotificationGuideUserId] = useState(0)
  const [userLevelTasks, setUserLevelTasks] = useState<UserLevelTask[]>([])
  const [homeFeedLoading, setHomeFeedLoading] = useState(!initialSnapshot.feed)
  const [homeFeedError, setHomeFeedError] = useState(false)
  const [coursePreview, setCoursePreview] = useState(() => (
    loadCachedCoursePreview(runtimeConfig, campusName)
  ))
  const [discussionOpeningCourseId, setDiscussionOpeningCourseId] = useState('')
  const discussionOpeningRef = useRef(false)
  const [quickQuestionCourse, setQuickQuestionCourse] = useState<Parameters<typeof openClassDiscussion>[0] | null>(null)
  const [academicCalendarLabel, setAcademicCalendarLabel] = useState(
    loadCachedAcademicLabel,
  )
  const [bannerIndex, setBannerIndex] = useState(0)
  const homeFeedRequestSequence = useRef(0)
  const homeFeedLoadingMoreRef = useRef(false)
  const homeHasShown = useRef(false)
  const homeBackTopVisibleRef = useRef(false)
  const applyCampus = useCallback((selectedCampus: string) => {
    try {
      // 先持久化，避免存储失败时首页与课表使用不同校区。
      saveSelectedCampus(selectedCampus)
    } catch {
      void Taro.showToast({ title: '校区保存失败，请重试', icon: 'none' })
      return
    }
    const config = getMiniappRuntimeConfig()
    setRuntimeConfig(config)
    setCampusName(selectedCampus)
    setBannerIndex(0)
    setCoursePreview(loadCachedCoursePreview(config, selectedCampus))
  }, [])
  const dismissCampusLocationPrompt = useCampusLocationPrompt(
    viewPageVisible && !homeFeedLoading && !homeFeedRefreshing
      && !showNotificationGuide && !homeCommentItem && !isAccountCancelled(),
    applyCampus,
  )
  const headerCollapsed = useCollapsingHeader({
    triggerSelector: '.campus__eyebrow',
    threshold: 48,
    releaseGap: 16,
  })

  usePageScroll(({ scrollTop }) => {
    const nextVisible = Number(scrollTop) > 480
    if (nextVisible === homeBackTopVisibleRef.current) return
    homeBackTopVisibleRef.current = nextVisible
    setShowHomeBackTop(nextVisible)
  })

  useReachBottom(() => {
    setHomeFeedLoadMoreSignal((current) => current + 1)
  })

  const loadHome = useCallback(async (force = false) => {
    const key = homeCacheKey()
    const requestScope = getPageCacheScope()
    const homeFeedRequestId = ++homeFeedRequestSequence.current
    const isCurrent = () => mounted.current && key === homeCacheKey()
      && homeFeedRequestId === homeFeedRequestSequence.current
    setQuickQuestionCourse(null)
    homeFeedLoadingMoreRef.current = false
    setHomeFeedLoadingMore(false)
    setHomeFeedLoadMoreError(false)
    setHomeFeedRefreshing(true)
    // 同步配置决定首屏，不把配置、授权或任一区块放在渲染的前置链路。
    const latestRuntimeConfig = getMiniappRuntimeConfig()
    const moduleEnabled = (moduleKey: MiniappModuleKey) => (
      resolveMiniappModule(latestRuntimeConfig, moduleKey).state === 'enabled'
    )
    const accountPromise = settle(getCurrentUser({ force }))
    const homeFeedEnabled = ['community', 'marketplace', 'errand', 'carpool']
      .some((moduleKey) => moduleEnabled(moduleKey as MiniappModuleKey))
    const refreshFeed = async (config: MiniappRuntimeConfig) => {
      if (!fullLifeServicesRepository || isQualificationEdition) return
      const enabled = ['community', 'marketplace', 'errand', 'carpool']
        .some((moduleKey) => resolveMiniappModule(config, moduleKey as MiniappModuleKey).state === 'enabled')
      if (!enabled) return
      const revision = getLifeHubRefreshRevision('community')
      await refreshHomeSection(
        () => fullLifeServicesRepository.listHomeFeed({ page: 1, pageSize: HOME_FEED_PAGE_SIZE }),
        (result) => {
          if (revision !== getLifeHubRefreshRevision('community')) return
          const feed = { items: enabledHomeFeedItems(result.items, getMiniappRuntimeConfig()), page: result.page, total: Number(result.total) }
          setHomeFeedItems(feed.items)
          setHomeFeedPage(feed.page)
          setHomeFeedTotal(feed.total)
          setHomeReactions({})
          setHomeFeedError(false)
          updateHomeSnapshot(key, { feed })
        }, isCurrent, () => setHomeFeedError(true),
      )
      if (isCurrent()) { setHomeFeedLoading(false); setHomeFeedRefreshing(false) }
    }
    const jobs = [
      refreshHomeSection(() => loadMiniappRuntimeConfig({ force }), (config) => {
        setRuntimeConfig(config)
        setCampusName(getSelectedCampus(config))
        setHomeFeedItems((items) => enabledHomeFeedItems(items, config))
        if (!homeFeedEnabled) void refreshFeed(config)
      }, () => mounted.current && requestScope === getPageCacheScope()
        && homeFeedRequestId === homeFeedRequestSequence.current),
      refreshFeed(latestRuntimeConfig),
      refreshHomeSection(() => accountPromise, (account) => {
        if (!account.ok) return
        setUsername(account.value.user.username)
        setAvatarUrl(account.value.user.avatar_url || '')
        setAvatarUserId(account.value.user.id)
      }, isCurrent),
      refreshHomeSection(() => moduleEnabled('academic_schedule')
        ? loadHomeAcademic(accountPromise, force, isCurrent)
        : Promise.resolve(academicStorage.getScheduleCache(getCachedPageUserId())), (cache) => {
        setCoursePreview(resolveCoursePreview(cache, academicStorage.getCustomCourses(getCachedPageUserId()),
          getMiniappRuntimeConfig(), getSelectedCampus(getMiniappRuntimeConfig()), new Date(), HOME_COURSE_PREVIEW_LIMIT))
        setAcademicCalendarLabel(getAcademicCalendarLabel(cache?.periods || []))
      }, isCurrent),
      refreshHomeSection(() => officialNoticesRepository.feed({ pageSize: 2 }), (result) => {
        setOfficialNotices(result.items)
        setNoticesError(false)
        updateHomeSnapshot(key, { notices: result.items })
      }, isCurrent, () => setNoticesError(true)).then(() => { if (isCurrent()) setNoticesLoading(false) }),
      refreshHomeSection(() => moduleEnabled('calendar')
        ? loadAcademicCalendar(getCalendarEducationLevel(), { force })
        : Promise.resolve({ calendar: null, source: 'unavailable' as const, updatedAt: 0 }), (result) => {
        if (result.source !== 'unavailable') setCalendar(result.calendar)
      }, isCurrent),
      refreshHomeSection(async () => {
        const account = await accountPromise
        if (!account.ok || !isCurrent()) return null
        return getMyDailyCheckinStatus()
      }, (result) => {
        if (!result) return
        setDailyCheckin(result)
        updateHomeSnapshot(key, { checkin: result })
      }, isCurrent),
      refreshHomeSection(async () => {
        const account = await accountPromise
        if (!account.ok || !isCurrent()) return null
        return listMyCalendarReminders()
      }, (result) => {
        if (!result) return
        setCalendarReminders(result.items)
        updateHomeSnapshot(key, { reminders: result.items })
      }, isCurrent),
      refreshHomeSection(async () => {
        const account = await accountPromise
        if (!account.ok || !isCurrent() || !homeFeatureFlags.todayTask) return null
        return listMyUserLevelTasks()
      }, (result) => { if (result) setUserLevelTasks(result.items) }, isCurrent),
      refreshHomeSection(async () => {
        const account = await accountPromise
        if (!account.ok || !isCurrent()) return null
        const templateIds = resolveHomeNotificationTemplateIds(latestRuntimeConfig.subscription_templates)
        const [notice, privateMessage, settings] = await Promise.all([
          settle(noticesRepository.unreadCount()), settle(refreshPrivateMessageUnreadCount(force)),
          getWechatSubscriptionSettings(templateIds),
        ])
        return { userId: account.value.user.id, templateIds, settings,
          unread: (notice.ok ? Number(notice.value.count) || 0 : 0) + (privateMessage.ok ? Number(privateMessage.value) || 0 : 0) }
      }, (result) => {
        if (!result) return
        const show = !result.settings.enabled && shouldShowHomeNotificationGuide({
          userId: result.userId, unreadCount: result.unread, templateIds: result.templateIds,
          record: readHomeNotificationGuideRecord(result.userId),
        })
        if (show) saveHomeNotificationGuideRecord(result.userId)
        setNotificationGuideUserId(result.userId)
        setCustomTabBarHidden(show)
        setShowNotificationGuide(show)
      }, isCurrent),
    ]
    if (!homeFeedEnabled || isQualificationEdition) {
      setHomeFeedLoading(false)
      setHomeFeedRefreshing(false)
    }
    try { await Promise.all(jobs) } finally {
      if (isCurrent()) {
        setHomeFeedLoading(false)
        setHomeFeedRefreshing(false)
        void Taro.stopPullDownRefresh()
      }
    }
  }, [])

  // 校区变化时立即换为对应缓存；返回详情不重置同校区分页。
  useEffect(() => {
    const snapshot = readHomeSnapshot()
    setHomeFeedItems(enabledHomeFeedItems(snapshot.feed?.items || [], getMiniappRuntimeConfig()))
    setHomeFeedPage(snapshot.feed?.page || 1)
    setHomeFeedTotal(snapshot.feed?.total || 0)
    setOfficialNotices(snapshot.notices || [])
    setNoticesError(false)
    setNoticesLoading(!snapshot.notices)
    setCalendarReminders(snapshot.reminders || [])
    setDailyCheckin(snapshot.checkin || null)
    setHomeFeedError(false)
    setHomeFeedLoading(!snapshot.feed)
    void loadHome()
    return () => { homeFeedRequestSequence.current += 1 }
  }, [campusName, loadHome])

  const loadHomeFeedMore = useCallback(async () => {
    if (
      !fullLifeServicesRepository
      || isQualificationEdition
      || homeFeedLoadingMoreRef.current
      || homeFeedRefreshing
      || homeFeedItems.length >= homeFeedTotal
    ) return

    const key = homeCacheKey()
    const requestId = ++homeFeedRequestSequence.current
    homeFeedLoadingMoreRef.current = true
    setHomeFeedLoadingMore(true)
    setHomeFeedLoadMoreError(false)
    try {
      const latestRuntimeConfig = getMiniappRuntimeConfig()
      const result = await fullLifeServicesRepository.listHomeFeed({
        page: homeFeedPage + 1,
        pageSize: HOME_FEED_PAGE_SIZE,
      })
      if (!mounted.current || key !== homeCacheKey() || requestId !== homeFeedRequestSequence.current) return
      setHomeFeedItems((current) => mergeHomeFeedItems(
        current,
        enabledHomeFeedItems(result.items, latestRuntimeConfig),
      ))
      setHomeFeedPage(result.page)
      setHomeFeedTotal(Number(result.total))
    } catch {
      if (requestId === homeFeedRequestSequence.current) {
        setHomeFeedLoadMoreError(true)
      }
    } finally {
      if (requestId === homeFeedRequestSequence.current) {
        homeFeedLoadingMoreRef.current = false
        setHomeFeedLoadingMore(false)
      }
    }
  }, [homeFeedItems.length, homeFeedPage, homeFeedRefreshing, homeFeedTotal])

  useEffect(() => {
    const timer = setInterval(() => {
      setCoursePreview(loadCachedCoursePreview(runtimeConfig, campusName))
    }, 60000)
    return () => clearInterval(timer)
  }, [campusName, runtimeConfig])

  useDidShow(() => {
    setShortcutKeys(readShortcuts())
    syncCustomTabBar('home')
    if (isAccountCancelled()) {
      void Taro.reLaunch({ url: '/pages/account-cancellation/index?success=1' })
      return
    }
    const config = getMiniappRuntimeConfig()
    const selectedCampus = getSelectedCampus(config)
    setRuntimeConfig(config)
    setCampusName(selectedCampus)
    setCoursePreview(loadCachedCoursePreview(config, selectedCampus))
    // 首页从详情返回时保留 Feed 分页和滚动位置，完整刷新交给下拉刷新。
    if (homeHasShown.current) return
    homeHasShown.current = true
  })

  usePullDownRefresh(() => {
    setCoursePreview(loadCachedCoursePreview(runtimeConfig, campusName))
    setAcademicCalendarLabel(loadCachedAcademicLabel())
    void loadHome(true)
  })

  const openLifeHub = async (section: LifeHubSection) => {
    const moduleKey = lifeSectionModules[section]
    if (isQualificationEdition) {
      const module = section === 'market' ? 'marketplace' : section === 'errands' ? 'errand' : section
      await openMigratedFeaturePage({ module })
      return
    }
    if (resolveMiniappModule(runtimeConfig, moduleKey).state === 'enabled') {
      Taro.setStorageSync(LIFE_HUB_SECTION_KEY, section)
    }
    await openMiniappModule(
      moduleKey,
      '/pages/community/index',
      { tab: true, config: runtimeConfig },
    )
  }

  const openAllServices = () => {
    Taro.navigateTo({ url: '/pages/services/index' })
  }

  const openSchedule = () => {
    void openMiniappModule(
      'academic_schedule',
      '/pages/academic/schedule/index',
      { config: runtimeConfig },
    )
  }

  const openCourseDiscussion = async (
    course: Parameters<typeof openClassDiscussion>[0],
    question?: ClassQuickQuestionId,
  ) => {
    if (discussionOpeningRef.current) return
    discussionOpeningRef.current = true
    setDiscussionOpeningCourseId(course.id)
    try {
      await openClassDiscussion(course, runtimeConfig, question)
    } finally {
      discussionOpeningRef.current = false
      setDiscussionOpeningCourseId('')
    }
  }

  const openCalendar = () => {
    void openMiniappModule('calendar', '/pages/calendar/index', { config: runtimeConfig })
  }

  const chooseCampus = async () => {
    dismissCampusLocationPrompt()
    const campuses = enabledCampuses(runtimeConfig)
    const tapIndex = await showActionSheetSelection(campuses)
    if (tapIndex === null) return
    const selectedCampus = campuses[tapIndex]
    setQuickQuestionCourse(null)
    applyCampus(selectedCampus)
  }

  const openHomeFeedItem = (item: HomeFeedItemView) => {
    setOpenHomeActionKey(null)
    const routes: Record<HomeFeedItemView['source_type'], string> = {
      campus_circle_post: `/pages/community/detail?id=${item.source_id}`,
      marketplace_listing: `/pages/marketplace/detail?id=${item.source_id}`,
      errand: `/pages/errands/detail?id=${item.source_id}`,
      carpool: `/pages/carpool/detail?id=${item.source_id}`,
    }
    void Taro.navigateTo({ url: routes[item.source_type] })
  }

  const toggleHomeFeedLike = async (item: HomeFeedItemView) => {
    if (!fullLifeServicesRepository || item.source_type !== 'campus_circle_post') return
    const key = homeFeedKey(item)
    const cacheKey = homeCacheKey()
    const current = homeReactions[key] || {
      liked: item.liked,
      likeCount: item.like_count,
      likedByNicknames: item.liked_by_nicknames,
    }
    try {
      const reaction = current.liked
        ? await fullLifeServicesRepository.unlikeResource(item.source_id, 'campus_circle_post')
        : await fullLifeServicesRepository.likeResource(item.source_id, 'campus_circle_post')
      if (!mounted.current || cacheKey !== homeCacheKey()) return
      markLifeHubSectionDirty('community')
      const currentUserName = username.trim()
      const likedByNicknames = reaction.liked
        ? currentUserName && !current.likedByNicknames.includes(currentUserName)
          ? [currentUserName, ...current.likedByNicknames].slice(0, 5)
          : current.likedByNicknames
        : currentUserName
          ? current.likedByNicknames.filter((nickname) => nickname !== currentUserName)
          : current.likedByNicknames.slice(0, reaction.like_count)
      setHomeReactions((reactions) => ({
        ...reactions,
        [key]: {
          liked: reaction.liked,
          likeCount: reaction.like_count,
          likedByNicknames: likedByNicknames.slice(0, reaction.like_count),
        },
      }))
    } catch {
      Taro.showToast({ title: '操作失败，请稍后重试', icon: 'none' })
    }
  }

  const updateHomeFeedComment = (target: HomeFeedItemView, comment: CommentView) => {
    setHomeFeedItems((current) => current.map((item) => (
      item.source_type === target.source_type && item.source_id === comment.target_id
        ? {
            ...item,
            comment_previews: mergePublicCommentPreview(
              item.comment_previews,
              comment,
              homeCommentReplyTarget,
            ),
          }
        : item
    )))
  }

  const dismissCommunityOverlays = useCallback(() => {
    setOpenHomeActionKey(null)
    if (homeCommentItem) {
      setCommentDismissSignal((current) => current + 1)
    }
  }, [homeCommentItem])

  const scrollHomeToTop = useCallback(() => {
    void Taro.pageScrollTo({ scrollTop: 0, duration: 240 })
  }, [])

  useDismissCommunityOverlaysOnScroll({
    active: openHomeActionKey !== null || (homeCommentItem !== null && !homeCommentSubmitting),
    onDismiss: dismissCommunityOverlays,
  })

  const updateHomeFeedCommentCount = useCallback((target: HomeFeedItemView, delta: number) => {
    setHomeFeedItems((current) => current.map((item) => (
      item.source_type === target.source_type && item.source_id === target.source_id
        ? { ...item, comment_count: Math.max(0, item.comment_count + delta) }
        : item
    )))
  }, [])

  const openOfficialNotices = () => {
    void Taro.navigateTo({ url: '/pages/official-notices/index' })
  }

  const openOfficialNotice = (item: OfficialNotice) => {
    void Taro.navigateTo({ url: `/pages/official-notices/detail?id=${item.id}` })
  }

  const banners = activeBanners(runtimeConfig, campusName)
  const runtimeBanner = banners[bannerIndex % Math.max(1, banners.length)] || null
  const slogans = activeSlogans(runtimeConfig, campusName)
  const sloganInterval = Math.min(
    30000,
    Math.max(3000, runtimeConfig.slogan_interval_ms),
  )
  const visibleHomeServices = shortcutKeys.map((key) => allServices.find((item) => item.key === key)).filter((service): service is typeof allServices[number] => {
    if (!service || (isQualificationEdition && migratedHomeServiceKeys.has(service.key))) return false
    const moduleKey = serviceModuleKeys[service.key]
    return !moduleKey || resolveMiniappModule(runtimeConfig, moduleKey, campusName).state === 'enabled'
  })
  const featuredHomeServices = visibleHomeServices
  const migrationGuide = getMigrationGuideCopy(runtimeConfig)
  const homeFeedCanLoadMore = homeFeedItems.length < homeFeedTotal
  useLoadMoreSignal({
    signal: homeFeedLoadMoreSignal,
    enabled: Boolean(fullLifeServicesRepository)
      && !isQualificationEdition
      && !homeFeedLoading
      && !homeFeedRefreshing
      && !homeFeedLoadingMore
      && !homeFeedError
      && homeFeedCanLoadMore,
    onLoadMore: loadHomeFeedMore,
  })
  const momentsLoading = homeFeedLoading
  const momentsError = homeFeedError && homeFeedItems.length === 0
  const todayCalendarEvents = upcomingHomeCalendarEvents(calendar, campusName)
  const scheduleCountLabel = coursePreview.dayLabel === '假期'
    ? coursePreview.dateLabel
    : `共 ${coursePreview.total} 门`
  const todayTask = resolveTodayTask(dailyCheckin, userLevelTasks)


  const toggleCalendarReminder = async (eventId: string) => {
    const existing = calendarReminders.find((item) => item.event_id === eventId)
    try {
      if (existing) {
        const result = await Taro.showActionSheet({ itemList: ['取消提醒'] })
        if (result.tapIndex !== 0) return
        await deleteMyCalendarReminder(existing.id)
        setCalendarReminders((items) => items.filter((item) => item.id !== existing.id))
        Taro.showToast({ title: '已取消提醒', icon: 'success' })
        return
      }
      const choices = [
        { days: 0 as const, label: '当天提醒' },
        { days: 1 as const, label: '提前 1 天' },
        { days: 3 as const, label: '提前 3 天' },
        { days: 7 as const, label: '提前 7 天' },
      ]
      const result = await Taro.showActionSheet({ itemList: choices.map((item) => item.label) })
      const choice = choices[result.tapIndex]
      if (!choice) return
      const reminder = await putMyCalendarReminder({
        advance_days: choice.days,
        education_level: getCalendarEducationLevel(),
        event_id: eventId,
      })
      setCalendarReminders((items) => [
        reminder,
        ...items.filter((item) => item.event_id !== eventId),
      ])
      Taro.showToast({ title: '提醒已设置', icon: 'success' })
    } catch (error) {
      if ((error as { errMsg?: string })?.errMsg?.includes('cancel')) return
      Taro.showToast({ title: '提醒设置失败，请稍后重试', icon: 'none' })
    }
  }

  useEffect(() => {
    if (dailyCheckin) updateHomeSnapshot(homeCacheKey(), { checkin: dailyCheckin })
  }, [dailyCheckin])

  const openTodayTask = () => {
    if (!todayTask) return
    if (todayTask.route === '/pages/community/index') {
      void openLifeHub('community')
      return
    }
    void Taro.navigateTo({ url: todayTask.route })
  }

  const submitHomeCheckin = async () => {
    if (!dailyCheckin?.enabled || dailyCheckin.checked_in || homeCheckinSubmitting) return
    setHomeCheckinSubmitting(true)
    try {
      const result = await createDailyCheckin()
      setDailyCheckin((current) => current ? {
        ...current,
        checked_in: true,
        checked_in_at: result.checked_in_at,
        consecutive_days: result.consecutive_days,
        server_date: result.checked_in_date,
        today_reward: result.reward,
        user_level: result.user_level,
      } : current)
      Taro.showToast({
        title: result.already_checked_in ? '今日已签到' : `签到成功 +${result.reward}经验`,
        icon: 'none',
      })
    } catch (error) {
      Taro.showToast({
        title: isApiError(error) ? error.message : '签到失败，请稍后重试',
        icon: 'none',
      })
    } finally {
      setHomeCheckinSubmitting(false)
    }
  }

  const dismissNotificationGuide = () => {
    setCustomTabBarHidden(false)
    setShowNotificationGuide(false)
  }

  const enableNotificationGuide = async () => {
    if (!notificationGuideUserId) return
    // 在原始点击同步链路中调起设置页，统一由微信设置管理总开关与各模板。
    const openSettings = openWechatSubscriptionSettings()
    setCustomTabBarHidden(false)
    setShowNotificationGuide(false)
    const opened = await openSettings
    if (!opened) Taro.showToast({ title: '暂时无法打开提醒设置', icon: 'none' })
  }

  const openRuntimeBanner = (banner: RuntimeBanner) => {
    if (banner.action.type === 'miniapp_path' && banner.action.value) {
      Taro.navigateTo({ url: banner.action.value })
      return
    }
    if (banner.action.type === 'webview') {
      const target = normalizeWebViewUrl(banner.action.value)
      if (!target) {
        Taro.showToast({ title: '链接配置无效', icon: 'none' })
        return
      }
      Taro.navigateTo({
        url: `/pages/webview/index?url=${encodeURIComponent(target)}`,
      })
    }
  }
  const bannerActionable = !!runtimeBanner && (
    (runtimeBanner.action.type === 'miniapp_path' && !!runtimeBanner.action.value)
    || (runtimeBanner.action.type === 'webview'
      && !!normalizeWebViewUrl(runtimeBanner.action.value))
  )

  const calendarTimeline = (
    <View className='schedule-card__timeline home-course-events'>
      {todayCalendarEvents.map((event, eventIndex) => {
        const reminder = calendarReminders.find((item) => item.event_id === event.id)
        return (
          <View
            key={`calendar-${event.id}`}
            className={[
              'schedule-card__course-row',
              'today-card__event-row',
              eventIndex === 0 ? 'today-card__event-row--first' : '',
              event.priority === 'important' ? 'today-card__event-row--important' : '',
            ].filter(Boolean).join(' ')}
            ariaRole='button'
            ariaLabel={`查看校历：${event.title}`}
            onClick={openCalendar}
          >
            <View className='home-course-events__copy'>
              <Text className='home-course-events__date'>{calendarEventDateLabel(event)}</Text>
              <View className='today-card__event-title-line'>
                <Text className='schedule-card__course-name'>{event.title}</Text>
                {event.priority === 'important' && <Text className='today-card__important'>重要</Text>}
              </View>
            </View>
            {event.remindable && (
              <View
                className={[
                  'today-card__reminder',
                  reminder ? 'today-card__reminder--active' : '',
                ].filter(Boolean).join(' ')}
                ariaRole='button'
                ariaLabel={reminder ? '取消提醒' : '设置提醒'}
                onClick={(clickEvent) => {
                  clickEvent.stopPropagation()
                  void toggleCalendarReminder(event.id)
                }}
              >
                {reminder ? `已设 ${reminder.advance_days} 天` : '提醒我'}
              </View>
            )}
          </View>
        )
      })}
    </View>
  )

  return (
    <View className='campus campus--course-home'>
      <CustomNavbar
        title='OUSea'
        immersive
        compactImmersive
        collapsed={headerCollapsed}
      />

      <View className='campus__header motion-enter'>
        <View className='campus__identity'>
          <UserAvatar
            className='campus__avatar'
            imageClassName='campus__avatar-image'
            src={avatarUrl}
            fallback={avatarText(username)}
            userId={avatarUserId}
          >
            <View className='campus__online' />
          </UserAvatar>
          <View className='campus__identity-copy'>
            <View className='campus__week-row'>
              <Text className='campus__eyebrow'>{academicCalendarLabel}</Text>
              {dailyCheckin?.enabled && !dailyCheckin.checked_in && (
                <View
                  className={`campus__checkin ${homeCheckinSubmitting ? 'campus__checkin--loading' : ''}`}
                  ariaRole='button'
                  ariaLabel={`今日签到，可获得 ${dailyCheckin.today_reward} 经验`}
                  onClick={() => void submitHomeCheckin()}
                >
                  <Image src={icons.check} mode='aspectFit' />
                  <Text>{homeCheckinSubmitting ? '签到中' : '签到'}</Text>
                </View>
              )}
              {dailyCheckin?.enabled && dailyCheckin.checked_in && (
                <View
                  className='campus__checkin campus__checkin--completed'
                  ariaLabel={`今日已签到，已连续签到 ${dailyCheckin.consecutive_days} 天`}
                >
                  <Image src={icons.check} mode='aspectFit' />
                  <Text>已连签 {dailyCheckin.consecutive_days} 天</Text>
                </View>
              )}
            </View>
            <View
              className='campus__school'
              ariaRole='button'
              ariaLabel={`切换校区，当前为${campusName}`}
              onClick={chooseCampus}
            >
              <Text>{campusName}</Text>
              <Image className='campus__chevron' src={icons.arrow} mode='aspectFit' />
            </View>
          </View>
        </View>
      </View>

      <View className='service-panel motion-enter motion-enter--delay-3'>
        <View className='service-panel__home-grid'>
          {featuredHomeServices.map((item) => (
            <View
              key={item.key}
              className={`service-panel__grid-item service-panel__grid-item--${getServiceIcon(item.key, campusTheme).tone} service-panel__grid-item--key-${item.key}`}
              ariaRole='button'
              ariaLabel={item.name}
              onClick={() => openCustomService(item, runtimeConfig)}
            >
              <View className={`service-panel__grid-icon service-panel__grid-icon--${getServiceIcon(item.key, campusTheme).tone}`}>
                <Image src={getServiceIcon(item.key, campusTheme).src} mode='aspectFit' />
              </View>
              <Text className='service-panel__grid-name'>{item.name}</Text>
            </View>
          ))}
          <View className='service-panel__grid-item service-panel__grid-item--all' ariaRole='button' ariaLabel='查看全部服务' onClick={openAllServices}>
            <View className='service-panel__grid-icon'><Image src={allServicesIcon} mode='aspectFit' /></View>
            <Text className='service-panel__grid-name'>全部服务</Text>
          </View>
        </View>
      </View>

      <View className='home-course-section motion-enter motion-enter--delay-2'>
        <View className='home-course-section__header'>
          <View className='home-course-section__heading'>
            <View className='home-course-section__bar' />
            <Text className='home-course-section__title'>
              {coursePreview.dayLabel === '假期' ? '假期安排' : coursePreview.dayLabel === '明天' ? '明日课程' : '今日课程'}
            </Text>
            <Text className='home-course-section__count'>{scheduleCountLabel}</Text>
          </View>
          <View className='home-course-section__all' ariaRole='button' ariaLabel='查看完整课程表' onClick={openSchedule}>
            <Text>整周课表</Text><Image src={icons.arrow} mode='aspectFit' />
          </View>
        </View>
        <View className={todayCalendarEvents.length > 0 ? 'home-course-section__card home-course-section__card--with-events' : 'home-course-section__card'}>
          {coursePreview.items.length > 0 ? (
            <HomeCourseCarousel
              key={coursePreview.items.map((item) => `${item.course.id}:${item.startsAt.getTime()}`).join('|')}
              items={coursePreview.items}
              openingCourseId={discussionOpeningCourseId}
              onViewSchedule={openSchedule}
              onDiscussion={(course) => { void openCourseDiscussion(course) }}
            />
          ) : (
            <View className='home-course-section__empty' ariaRole='button' ariaLabel='查看课程表' onClick={openSchedule}>
              <Text>{coursePreview.emptyText}</Text>
              {coursePreview.dayLabel !== '假期' && <Text>{coursePreview.emptyHint}</Text>}
            </View>
          )}
          {coursePreview.hiddenCount > 0 && (
            <View className='home-course-section__more' ariaRole='button' onClick={openSchedule}>
              还有 {coursePreview.hiddenCount} 门课程，查看完整课表
            </View>
          )}
          {todayCalendarEvents.length > 0 && calendarTimeline}
        </View>
      </View>

      {!isQualificationEdition && <TodayHotHomeEntry pageVisible={viewPageVisible} />}

      {homeFeatureFlags.todayTask && todayTask && (
        <View
          className={[
            'today-task',
            'motion-enter',
            'motion-enter--delay-3',
            todayTask.completed ? 'today-task--completed' : '',
          ].filter(Boolean).join(' ')}
          ariaRole='button'
          ariaLabel={`${todayTask.title}，${todayTask.actionLabel}`}
          onClick={openTodayTask}
        >
          <View className='today-task__marker'>1</View>
          <View className='today-task__copy'>
            <Text className='today-task__eyebrow'>今日一件事</Text>
            <Text className='today-task__title'>{todayTask.title}</Text>
            <Text className='today-task__description'>{todayTask.description}</Text>
          </View>
          <View className='today-task__action'>
            <Text>{todayTask.actionLabel}</Text>
            <Image src={icons.arrow} mode='aspectFit' />
          </View>
        </View>
      )}

      <View className='official-notices-home motion-enter motion-enter--delay-4'>
        <View
          className='official-notices-home__head'
          ariaRole='button'
          ariaLabel='查看全部官方通知'
          onClick={openOfficialNotices}
        >
          <View className='official-notices-home__heading'>
            <View className='official-notices-home__heading-bar' />
            <Text className='official-notices-home__title'>全校通知</Text>
          </View>
          <View className='official-notices-home__more'>
            <Text>查看全部</Text>
            <Image src={icons.arrow} mode='aspectFit' />
          </View>
        </View>
        {officialNotices.length === 0 ? (
          <View className='official-notices-home__empty' onClick={noticesError ? () => void loadHome() : openOfficialNotices}>
            {noticesLoading ? '正在加载通知' : noticesError ? '通知加载失败，点击重试' : '暂无最新通知，点击进入通知中心'}
          </View>
        ) : officialNotices.map((item) => (
          <View
            key={item.id}
            className='official-notices-home__item'
            ariaRole='button'
            ariaLabel={`查看通知：${item.title}`}
            onClick={() => openOfficialNotice(item)}
          >
            <Text className='official-notices-home__source-badge'>{officialNoticeSourceLabels[item.source]}</Text>
            <View className='official-notices-home__copy'>
              <Text className='official-notices-home__copy-title'>{item.title}</Text>
            </View>
            <Image className='official-notices-home__arrow' src={icons.arrow} mode='aspectFit' />
          </View>
        ))}
      </View>

      {isQualificationEdition ? (
        <View className='home-migrated motion-enter motion-enter--delay-1'>
          <View className='home-migrated__eyebrow'>新版服务</View>
          <Text className='home-migrated__title'>{migrationGuide.title}</Text>
          <Text className='home-migrated__copy'>{migrationGuide.description}</Text>
          <View
            className='home-migrated__action'
            onClick={() => void openMigratedFeaturePage({ module: 'community' })}
          >
            <Text>{migrationGuide.entry_button_text}</Text>
            <Image src={icons.arrow} mode='aspectFit' />
          </View>
          <Text className='home-migrated__hint'>{migrationGuide.hint}</Text>
        </View>
      ) : (<>
      {homeFeatureFlags.campusRecommendation && (<View
        className={[
          'hero-card',
          'motion-enter',
          'motion-enter--delay-1',
          'motion-press',
          runtimeBanner ? 'hero-card--notice' : '',
          runtimeBanner?.image_url ? 'hero-card--image' : '',
        ].filter(Boolean).join(' ')}
        ariaRole={!runtimeBanner || bannerActionable ? 'button' : undefined}
        ariaLabel={runtimeBanner?.title || '查看开学安排'}
        onClick={() => runtimeBanner
          ? openRuntimeBanner(runtimeBanner)
          : openCalendar()}
      >
        <View className='hero-card__glow' />
        {runtimeBanner?.image_url && (
          <>
            <Image
              className='hero-card__banner-image'
              src={runtimeBanner.image_url}
              mode='aspectFill'
            />
            <View className='hero-card__banner-overlay' />
          </>
        )}
        <View className='hero-card__content'>
          <View className='hero-card__pill'>
            <View className='hero-card__pulse' />
            <Text>{runtimeBanner ? '校园推荐' : '开学季'}</Text>
          </View>
          {runtimeBanner ? (
            <Swiper
              key={`${campusName}:${banners.map((banner) => banner.id).join(',')}`}
              className='hero-card__slogan-swiper'
              autoplay={banners.length > 1}
              circular={banners.length > 1}
              vertical
              interval={sloganInterval}
              duration={360}
              onChange={(event) => setBannerIndex(event.detail.current)}
            >
              {banners.map((banner) => (
                <SwiperItem key={banner.id}>
                  <View className='hero-card__slogan-slide'>
                    <Text className='hero-card__title'>{banner.title}</Text>
                    <Text className='hero-card__subtitle'>{banner.subtitle}</Text>
                  </View>
                </SwiperItem>
              ))}
            </Swiper>
          ) : (
            <Swiper
              key={campusName}
              className='hero-card__slogan-swiper'
              autoplay={slogans.length > 1}
              circular={slogans.length > 1}
              vertical
              interval={sloganInterval}
              duration={360}
            >
              {(slogans.length ? slogans : [{
                id: 'fallback',
                title: '新学期，从这片海出发',
                subtitle: '课表、成绩与校园服务触手可及',
              }]).map((slogan) => (
                <SwiperItem key={slogan.id}>
                  <View className='hero-card__slogan-slide'>
                    <Text className='hero-card__title'>{slogan.title}</Text>
                    <Text className='hero-card__subtitle'>{slogan.subtitle}</Text>
                  </View>
                </SwiperItem>
              ))}
            </Swiper>
          )}
          {(!runtimeBanner || bannerActionable) && (
            <View className='hero-card__action'>
              <Text>{runtimeBanner ? '查看详情' : '查看开学安排'}</Text>
              <Image src={icons.arrow} mode='aspectFit' />
            </View>
          )}
        </View>
        {!runtimeBanner?.image_url && (
          <View className='hero-card__art'>
            <View className='hero-card__bubble hero-card__bubble--one' />
            <View className='hero-card__bubble hero-card__bubble--two' />
            <View className='hero-card__sailboat'>
              <View className='hero-card__mast' />
              <View className='hero-card__sail hero-card__sail--main' />
              <View className='hero-card__sail hero-card__sail--small' />
              <View className='hero-card__hull' />
            </View>
          </View>
        )}
      </View>)}

      <View className='moments-panel'>
        <View className='moments-panel__header'>
          <View className='moments-panel__heading'>
            <View className='moments-panel__bar' />
            <Text className='moments-panel__title'>校园动态</Text>
          </View>
          <View
            className='moments-panel__more'
            ariaRole='button'
            ariaLabel='进入校园社区'
            onClick={() => openLifeHub('community')}
          >
            <Text>进社区</Text>
            <Image src={icons.arrow} mode='aspectFit' />
          </View>
        </View>

        <View className='moments-feed'>
          {momentsLoading && <View className='home-section-state'>正在加载校园动态</View>}
          {!momentsLoading && homeFeedError && (
            <View className='home-section-state home-section-state--error' onClick={() => void loadHome()}>
              {homeFeedItems.length ? '更新失败，正在显示上次内容，点击重试' : '动态加载失败，点击重试'}
            </View>
          )}
          {!momentsLoading && !momentsError && homeFeedItems.length === 0 && (
            <View className='home-section-state'>暂时没有校园动态</View>
          )}
          {!momentsLoading && homeFeedItems.map((item, index) => {
            const key = homeFeedKey(item)
            const post = homeFeedItemToPost(item, homeReactions[key])
            const variant = item.source_type === 'marketplace_listing'
              ? 'marketplace'
              : item.source_type === 'campus_circle_post' ? 'community' : item.source_type
            return (
              <CommunityPostCard
                key={`${key}-${item.version}`}
                post={post}
                instanceKey={key}
                trackViews={item.source_type === 'campus_circle_post'}
                viewExposureSurface='home'
                viewTrackingEnabled={viewPageVisible && !homeCommentItem && !showNotificationGuide}
                variant={variant}
                businessPreview={homeFeedBusinessPreview(item) || undefined}
                motionDelay={index + 1}
                sectionName={homeFeedSourceLabels[item.source_type]}
                timeFormatter={formatHomeMomentsTime}
                actionsOpen={openHomeActionKey === key}
                onToggleActions={() => setOpenHomeActionKey((current) => current === key ? null : key)}
                onCloseActions={() => setOpenHomeActionKey(null)}
                onToggleLike={item.source_type === 'campus_circle_post'
                  ? () => toggleHomeFeedLike(item)
                  : undefined}
                onOpen={() => openHomeFeedItem(item)}
                onOpenComments={() => {
                  setOpenHomeActionKey(null)
                  setHomeCommentSubmitting(false)
                  setHomeCommentReplyTarget(null)
                  setHomeCommentItem(item)
                }}
                onReplyComment={(_, comment) => {
                  setOpenHomeActionKey(null)
                  setHomeCommentSubmitting(false)
                  setHomeCommentReplyTarget(comment)
                  setHomeCommentItem(item)
                }}
              />
            )
          })}
          {!momentsLoading && !momentsError && homeFeedCanLoadMore && (
            <View className='moments-feed__load-more' ariaRole='status'>
              {homeFeedLoadingMore
                ? '正在加载更多…'
                : homeFeedLoadMoreError
                  ? '加载失败，请继续上滑重试'
                  : '继续上滑加载更多'}
            </View>
          )}
          {!momentsLoading && !momentsError && homeFeedItems.length > 0 && !homeFeedCanLoadMore && (
            <View className='moments-feed__load-more moments-feed__load-more--end' ariaRole='status'>
              没有更多了
            </View>
          )}
        </View>
      </View>
      <View
        className={`home-back-top ${showHomeBackTop ? 'home-back-top--visible' : ''}`}
        ariaRole='button'
        ariaLabel='返回顶部'
        onClick={scrollHomeToTop}
      >
        <Image src={icons.arrowUp} mode='aspectFit' />
        <Text>顶部</Text>
      </View>
      <BottomSheet
        visible={quickQuestionCourse !== null}
        title='向同学提问'
        onClose={() => setQuickQuestionCourse(null)}
      >
        <View className='home-class-question'>
          <View className='home-class-question__context'>
            <Text className='home-class-question__name'>{quickQuestionCourse?.name}</Text>
            <Text className='home-class-question__meta'>
              {quickQuestionCourse?.periodId} · 选课号 {quickQuestionCourse?.classNum}
            </Text>
          </View>
          {([
            { id: 'homework', label: '问作业' },
            { id: 'materials', label: '求资料' },
            { id: 'free', label: '自由提问' },
          ] as const).map((question) => (
            <View
              key={question.id}
              className={`home-class-question__option home-class-question__option--${question.id}`}
              ariaRole='button'
              ariaLabel={`${question.label}，发布到${quickQuestionCourse?.name}`}
              onClick={() => {
                if (!quickQuestionCourse || discussionOpeningCourseId) return
                setQuickQuestionCourse(null)
                void openCourseDiscussion(quickQuestionCourse, question.id)
              }}
            >
              <Text>{question.label}</Text>
              <Image src={scheduleCalendarArrowIcon} mode='aspectFit' />
            </View>
          ))}
        </View>
      </BottomSheet>
      {homeCommentItem ? (
        <CommunityCommentSheet
          key={`${homeCommentItem.source_type}-${homeCommentItem.source_id}`}
          target={{
            type: homeCommentItem.source_type === 'marketplace_listing'
              ? 'marketplace'
              : homeCommentItem.source_type === 'campus_circle_post'
                ? 'campus_circle_post'
                : homeCommentItem.source_type,
            id: homeCommentItem.source_id,
            enabled: true,
            tone: homeCommentItem.source_type === 'marketplace_listing'
              ? 'marketplace'
              : homeCommentItem.source_type === 'campus_circle_post'
                ? 'community'
                : homeCommentItem.source_type,
            dirtySection: homeCommentItem.source_type === 'marketplace_listing'
              ? 'market'
              : homeCommentItem.source_type === 'campus_circle_post'
                ? 'community'
                : homeCommentItem.source_type === 'errand' ? 'errands' : 'carpool',
            placeholder: '友善交流，分享你的想法',
          }}
          initialReplyTarget={homeCommentReplyTarget ? {
            id: homeCommentReplyTarget.id,
            author_id: homeCommentReplyTarget.authorId,
            author_deleted: homeCommentReplyTarget.authorDeleted,
            author_nickname: homeCommentReplyTarget.authorNickname,
            root_id: homeCommentReplyTarget.rootId,
          } : null}
          onClose={() => {
            setHomeCommentItem(null)
            setHomeCommentReplyTarget(null)
            setHomeCommentSubmitting(false)
          }}
          onSubmittingChange={setHomeCommentSubmitting}
          dismissSignal={commentDismissSignal}
          onApprovedDelta={(delta) => updateHomeFeedCommentCount(homeCommentItem, delta)}
          onCommentCreated={(comment) => updateHomeFeedComment(homeCommentItem, comment)}
        />
      ) : null}
      {showNotificationGuide && (
        <View className='home-notification-guide' onClick={dismissNotificationGuide}>
          <View
            className='home-notification-guide__sheet'
            ariaRole='dialog'
            ariaLabel='开启消息提醒'
            onClick={(event) => event.stopPropagation()}
          >
            <View className='home-notification-guide__handle' />
            <View className='home-notification-guide__icon'>
              <Image src={require('../../assets/icons/service-notification.svg')} mode='aspectFit' />
            </View>
            <Text className='home-notification-guide__title'>别错过校园新消息</Text>
            <Text className='home-notification-guide__description'>开启提醒后，重要消息会第一时间通知你。</Text>
            <View className='home-notification-guide__actions'>
              <View className='home-notification-guide__secondary' ariaRole='button' onClick={dismissNotificationGuide}>
                <Text>暂不提醒</Text>
              </View>
              <View className='home-notification-guide__primary' ariaRole='button' onClick={() => void enableNotificationGuide()}>
                <Text>开启提醒</Text>
              </View>
            </View>
          </View>
        </View>
      )}
      </>)}

    </View>
  )
}

export default Index
