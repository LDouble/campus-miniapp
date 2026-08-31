import { useCallback, useEffect, useRef, useState } from 'react'
import Taro, {
  useDidShow,
  usePageScroll,
  usePullDownRefresh,
  useReachBottom,
} from '@tarojs/taro'
import {
  Image,
  ScrollView,
  Swiper,
  SwiperItem,
  Text,
  View,
} from '@tarojs/components'
import { getCurrentUser } from '../../api/account'
import { getAcademicVerificationStatus } from '../../api/academic-verification'
import { getMyDailyCheckinStatus } from '../../api/daily-checkins'
import { listMyUserLevelTasks } from '../../api/user-levels'
import {
  deleteMyCalendarReminder,
  listMyCalendarReminders,
  putMyCalendarReminder,
} from '../../api/calendar-reminders'
import { isAccountCancelled } from '../../api/auth'
import {
  getActiveAcademicUserId,
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
import UserAvatar from '../../components/user-avatar'
import CommunityCommentSheet from '../../features/community/comment-sheet'
import CommunityPostCard, { type CommunityPostCommentPreview } from '../../features/community/post-card'
import { mergePublicCommentPreview } from '../../features/community/comments'
import { useDismissCommunityOverlaysOnScroll } from '../../features/community/use-overlay-dismissal'
import { showActionSheetSelection } from '../../utils/action-sheet'
import { isQualificationEdition } from '../../features/app-edition'
import { openMigratedFeaturePage } from '../../features/app-edition/navigation'
import {
  avatarText,
  resolveCoursePreview,
} from '../../features/home/data'
import {
  homeFeedItemToPost,
  homeFeedBusinessPreview,
  homeFeedKey,
  sourceLabels as homeFeedSourceLabels,
} from '../../features/home/feed-post-adapter'
import { formatHomeMomentsTime } from '../../features/home/moments'
import { officialNoticesRepository } from '../../features/official-notices/repository'
import {
  formatOfficialNoticeCompactDate,
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
  loadAcademicCalendar,
} from '../../features/calendar/repository'
import { syncCustomTabBar } from '../../utils/tabbar'
import { useCampusShare } from '../../features/share'
import {
  getCampusTheme,
  subscribeCampusTheme,
  type CampusTheme,
} from '../../features/theme-preference'
import './index.scss'

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
  clubs: require('../../assets/icons/clubs.svg'),
  whatToEat: require('../../assets/icons/what-to-eat.svg'),
  campaign: require('../../assets/icons/campaign.svg'),
  arrowUp: require('../../assets/icons/arrow-up.svg'),
}

// 首页服务入口使用预着色的 SDR SVG，避免微信 iOS 为 CSS filter 创建原生图像合成层。
const homeServiceIcons = {
  light: {
    academic: require('../../assets/icons/home-service-academic.svg'),
    calendar: require('../../assets/icons/home-service-calendar.svg'),
    schedule: require('../../assets/icons/home-service-schedule.svg'),
    grade: require('../../assets/icons/home-service-grade.svg'),
    exam: require('../../assets/icons/home-service-exam.svg'),
    result: require('../../assets/icons/home-service-result.svg'),
    passRate: require('../../assets/icons/home-service-pass-rate.svg'),
    materials: require('../../assets/icons/home-service-materials.svg'),
    shuttle: require('../../assets/icons/home-service-shuttle.svg'),
    carpool: require('../../assets/icons/home-service-carpool.svg'),
    community: require('../../assets/icons/home-service-community.svg'),
    market: require('../../assets/icons/home-service-market.svg'),
    errands: require('../../assets/icons/home-service-errands.svg'),
    clubs: require('../../assets/icons/home-service-clubs.svg'),
    whatToEat: require('../../assets/icons/home-service-what-to-eat.svg'),
  },
  dark: {
    academic: require('../../assets/icons/home-service-academic-dark.svg'),
    calendar: require('../../assets/icons/home-service-calendar-dark.svg'),
    schedule: require('../../assets/icons/home-service-schedule-dark.svg'),
    grade: require('../../assets/icons/home-service-grade-dark.svg'),
    exam: require('../../assets/icons/home-service-exam-dark.svg'),
    result: require('../../assets/icons/home-service-result-dark.svg'),
    passRate: require('../../assets/icons/home-service-pass-rate-dark.svg'),
    materials: require('../../assets/icons/home-service-materials-dark.svg'),
    shuttle: require('../../assets/icons/home-service-shuttle-dark.svg'),
    carpool: require('../../assets/icons/home-service-carpool-dark.svg'),
    community: require('../../assets/icons/home-service-community-dark.svg'),
    market: require('../../assets/icons/home-service-market-dark.svg'),
    errands: require('../../assets/icons/home-service-errands-dark.svg'),
    clubs: require('../../assets/icons/home-service-clubs-dark.svg'),
    whatToEat: require('../../assets/icons/home-service-what-to-eat-dark.svg'),
  },
}
type HomeServiceIconKey = keyof typeof homeServiceIcons.light

const homeFeatureFlags = {
  todayTask: false,
} as const

const HOME_COURSE_PREVIEW_LIMIT = 8
const SCHEDULE_SCROLL_VISIBLE_ROWS = 3

const quickServices = [
  {
    key: 'schedule',
    name: '课程表',
    iconKey: 'schedule' as HomeServiceIconKey,
    tone: 'blue',
    route: '/pages/academic/schedule/index',
  },
  {
    key: 'grades',
    name: '成绩',
    iconKey: 'grade' as HomeServiceIconKey,
    tone: 'blue',
    route: '/pages/academic/grades/index',
  },
  {
    key: 'exams',
    name: '考试',
    iconKey: 'exam' as HomeServiceIconKey,
    tone: 'sand',
    route: '/pages/academic/exams/index',
  },
  { key: 'result', name: '选课结果', iconKey: 'result' as HomeServiceIconKey, tone: 'blue', route: '/pages/academic/selection/index' },
  { key: 'pass-rate', name: '通过率', iconKey: 'passRate' as HomeServiceIconKey, tone: 'cyan', route: '/pages/academic/statistics/courses' },
  { key: 'materials', name: '资料', iconKey: 'materials' as HomeServiceIconKey, tone: 'cyan', route: '/pages/materials/index' },
  { key: 'calendar', name: '校历', iconKey: 'calendar' as HomeServiceIconKey, tone: 'pink', route: '/pages/calendar/index' },
  { key: 'shuttle', name: '校车', iconKey: 'shuttle' as HomeServiceIconKey, tone: 'blue', route: '/pages/shuttle/index' },
  { key: 'community', name: '社区', iconKey: 'community' as HomeServiceIconKey, tone: 'cyan', tab: '/pages/community/index' },
  { key: 'market', name: '二手', iconKey: 'market' as HomeServiceIconKey, tone: 'pink', module: 'market' },
  { key: 'errands', name: '跑腿', iconKey: 'errands' as HomeServiceIconKey, tone: 'sand', module: 'errands' },
  { key: 'carpool', name: '找同行', iconKey: 'carpool' as HomeServiceIconKey, tone: 'cyan', module: 'carpool' },
  { key: 'classroom', name: '空教室', iconKey: 'academic' as HomeServiceIconKey, tone: 'blue', route: '/pages/empty-classroom/index' },
  { key: 'clubs', name: '社团', iconKey: 'clubs' as HomeServiceIconKey, tone: 'cyan', route: '/pages/clubs/index' },
  { key: 'what-to-eat', name: '今天吃什么', iconKey: 'whatToEat' as HomeServiceIconKey, tone: 'sand', route: '/pages/what-to-eat/index' },
]

const migratedHomeServiceKeys = new Set([
  'materials',
  'community',
  'market',
  'errands',
  'carpool',
  'clubs',
])
const serviceModuleKeys: Partial<Record<string, MiniappModuleKey>> = {
  schedule: 'academic_schedule',
  grades: 'academic_grades',
  exams: 'academic_exams',
  result: 'academic_selection',
  'pass-rate': 'academic_statistics',
  materials: 'course_materials',
  calendar: 'calendar',
  shuttle: 'shuttle',
  community: 'community',
  market: 'marketplace',
  errands: 'errand',
  carpool: 'carpool',
  classroom: 'empty_classroom',
  clubs: 'club',
  'what-to-eat': 'what_to_eat',
}
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
  const userId = getActiveAcademicUserId()
  return resolveCoursePreview(
    academicStorage.getScheduleCache(userId),
    academicStorage.getCustomCourses(),
    config,
    campusName,
    new Date(),
    HOME_COURSE_PREVIEW_LIMIT,
  )
}

const loadCachedAcademicLabel = () => {
  const cache = academicStorage.getScheduleCache(getActiveAcademicUserId())
  return getAcademicCalendarLabel(cache?.periods || [])
}

const loadLatestAcademic = async (
  userId: number,
  cache: AcademicScheduleCache | null,
  force = false,
) => {
  const periodsResult = await settle(academicRepository.getPeriods({ force }))
  if (!periodsResult.ok || !periodsResult.value.length) return cache

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

  const { periodId } = resolveScheduleAnchor(periods)
  const anchoredPeriod = periods.find((period) => period.id === periodId)
  const isCurrentPeriod = !!anchoredPeriod
    && getCurrentAcademicWeek([anchoredPeriod]) !== null
  const hasCachedCourses = !!periodId
    && Object.prototype.hasOwnProperty.call(coursesByPeriod, periodId)
  const hasCredential = hasAcademicCredential(userId)

  if (periodId && isCurrentPeriod && !hasCachedCourses && hasCredential) {
    const coursesResult = await settle(academicRepository.getCourses(periodId))
    if (coursesResult.ok) {
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
) => {
  const account = await accountPromise
  const userId = account.ok ? account.value.user.id : getActiveAcademicUserId()
  const cache = academicStorage.getScheduleCache(userId)
  if (!account.ok) return cache

  const verification = await settle(getAcademicVerificationStatus({ force }))
  if (!verification.ok || verification.value.identity?.status !== 'verified') return cache
  return loadLatestAcademic(userId, cache, force)
}

function Index() {
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
  const [username, setUsername] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarUserId, setAvatarUserId] = useState(0)
  const [homeFeedItems, setHomeFeedItems] = useState<HomeFeedItemView[]>([])
  const [homeFeedPage, setHomeFeedPage] = useState(1)
  const [homeFeedTotal, setHomeFeedTotal] = useState(0)
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
  const [officialNotices, setOfficialNotices] = useState<OfficialNotice[]>([])
  const [calendar, setCalendar] = useState<Awaited<ReturnType<typeof loadAcademicCalendar>>['calendar']>(null)
  const [calendarReminders, setCalendarReminders] = useState<CalendarReminderView[]>([])
  const [dailyCheckin, setDailyCheckin] = useState<DailyCheckinStatus | null>(null)
  const [userLevelTasks, setUserLevelTasks] = useState<UserLevelTask[]>([])
  const [homeFeedLoading, setHomeFeedLoading] = useState(true)
  const [homeFeedError, setHomeFeedError] = useState(false)
  const [coursePreview, setCoursePreview] = useState(() => (
    loadCachedCoursePreview(runtimeConfig, campusName)
  ))
  const [academicCalendarLabel, setAcademicCalendarLabel] = useState(
    loadCachedAcademicLabel,
  )
  const [bannerIndex, setBannerIndex] = useState(0)
  const homeFeedRequestSequence = useRef(0)
  const homeFeedLoadingMoreRef = useRef(false)
  const homeHasShown = useRef(false)
  const homeBackTopVisibleRef = useRef(false)
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
    const homeFeedRequestId = ++homeFeedRequestSequence.current
    homeFeedLoadingMoreRef.current = false
    setHomeFeedLoadingMore(false)
    setHomeFeedLoadMoreError(false)
    setHomeFeedRefreshing(true)
    const latestRuntimeConfig = await loadMiniappRuntimeConfig()
    const moduleEnabled = (key: MiniappModuleKey) => (
      resolveMiniappModule(latestRuntimeConfig, key).state === 'enabled'
    )
    const accountPromise = settle(getCurrentUser({ force }))
    // 未认证用户只展示缓存；已认证用户才在后台刷新教务数据。
    const academicPromise = moduleEnabled('academic_schedule')
      ? loadHomeAcademic(accountPromise, force)
      : accountPromise.then((account) => academicStorage.getScheduleCache(
        account.ok ? account.value.user.id : getActiveAcademicUserId(),
      ))
    const homeFeedEnabled = ['community', 'marketplace', 'errand', 'carpool']
      .some((key) => moduleEnabled(key as MiniappModuleKey))
    const homeFeedPromise = !isQualificationEdition
      && fullLifeServicesRepository
      && homeFeedEnabled
      ? settle(fullLifeServicesRepository.listHomeFeed({ page: 1, pageSize: HOME_FEED_PAGE_SIZE }))
      : Promise.resolve({ ok: false } as Settled<never>)
    const officialNoticesPromise = settle(officialNoticesRepository.feed({
      pageSize: 2,
    }))
    const calendarPromise = moduleEnabled('calendar')
      ? loadAcademicCalendar(getCalendarEducationLevel(), { force })
      : Promise.resolve({ calendar: null, source: 'unavailable' as const, updatedAt: 0 })
    const checkinPromise = homeFeatureFlags.todayTask
      ? accountPromise.then((account) => (
        account.ok ? settle(getMyDailyCheckinStatus()) : { ok: false } as Settled<never>
      ))
      : Promise.resolve({ ok: false } as Settled<never>)
    const tasksPromise = homeFeatureFlags.todayTask
      ? accountPromise.then((account) => (
        account.ok ? settle(listMyUserLevelTasks()) : { ok: false } as Settled<never>
      ))
      : Promise.resolve({ ok: false } as Settled<never>)
    const remindersPromise = accountPromise.then((account) => (
      account.ok ? settle(listMyCalendarReminders()) : { ok: false } as Settled<never>
    ))
    const [
      account,
      homeFeed,
      latestAcademic,
      latestOfficialNotices,
      latestCalendar,
      latestCheckin,
      latestTasks,
      latestReminders,
    ] = await Promise.all([
      accountPromise,
      homeFeedPromise,
      academicPromise,
      officialNoticesPromise,
      calendarPromise,
      checkinPromise,
      tasksPromise,
      remindersPromise,
    ])

    const selectedCampus = getSelectedCampus(latestRuntimeConfig)
    setRuntimeConfig(latestRuntimeConfig)
    setCampusName(selectedCampus)
    setBannerIndex(0)
    setCoursePreview(resolveCoursePreview(
      latestAcademic,
      academicStorage.getCustomCourses(),
      latestRuntimeConfig,
      selectedCampus,
      new Date(),
      HOME_COURSE_PREVIEW_LIMIT,
    ))
    if (account.ok) {
      setUsername(account.value.user.username)
      setAvatarUrl(account.value.user.avatar_url || '')
      setAvatarUserId(account.value.user.id)
    }
    setAcademicCalendarLabel(getAcademicCalendarLabel(latestAcademic?.periods || []))
    if (homeFeedRequestId === homeFeedRequestSequence.current) {
      if (homeFeed.ok) {
        setHomeFeedItems(enabledHomeFeedItems(homeFeed.value.items, latestRuntimeConfig))
        setHomeFeedPage(homeFeed.value.page)
        setHomeFeedTotal(Number(homeFeed.value.total))
        setHomeReactions({})
        setHomeFeedError(false)
      } else {
        setHomeFeedItems([])
        setHomeFeedPage(1)
        setHomeFeedTotal(0)
        setHomeFeedError(homeFeedEnabled)
      }
    }
    setOfficialNotices(latestOfficialNotices.ok ? latestOfficialNotices.value.items : [])
    setCalendar(latestCalendar.calendar)
    setDailyCheckin(latestCheckin.ok ? latestCheckin.value : null)
    setUserLevelTasks(latestTasks.ok ? latestTasks.value.items : [])
    setCalendarReminders(latestReminders.ok ? latestReminders.value.items : [])
    if (homeFeedRequestId === homeFeedRequestSequence.current) {
      setHomeFeedLoading(false)
      setHomeFeedRefreshing(false)
    }
    Taro.stopPullDownRefresh()
  }, [])

  const loadHomeFeedMore = useCallback(async () => {
    if (
      !fullLifeServicesRepository
      || isQualificationEdition
      || homeFeedLoadingMoreRef.current
      || homeFeedRefreshing
      || homeFeedItems.length >= homeFeedTotal
    ) return

    const requestId = ++homeFeedRequestSequence.current
    homeFeedLoadingMoreRef.current = true
    setHomeFeedLoadingMore(true)
    setHomeFeedLoadMoreError(false)
    try {
      const latestRuntimeConfig = await loadMiniappRuntimeConfig()
      const result = await fullLifeServicesRepository.listHomeFeed({
        page: homeFeedPage + 1,
        pageSize: HOME_FEED_PAGE_SIZE,
      })
      if (requestId !== homeFeedRequestSequence.current) return
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
    syncCustomTabBar('home')
    if (isAccountCancelled()) {
      void Taro.reLaunch({ url: '/pages/account-cancellation/index?success=1' })
      return
    }
    // 首页从详情返回时保留 Feed 分页和滚动位置，完整刷新交给下拉刷新。
    if (homeHasShown.current) return
    homeHasShown.current = true
    void loadHome()
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

  const openAcademic = (route: string) => {
    const service = quickServices.find((item) => (
      'route' in item && item.route === route
    ))
    const moduleKey = service ? serviceModuleKeys[service.key] : undefined
    if (isQualificationEdition && moduleKey === 'course_materials') {
      void openMigratedFeaturePage({ module: 'course_materials' })
      return
    }
    if (moduleKey) {
      void openMiniappModule(moduleKey, route, { config: runtimeConfig })
      return
    }
    Taro.navigateTo({ url: route })
  }

  const openQuickService = (item: typeof quickServices[number]) => {
    if ('tab' in item && item.tab) {
      void openLifeHub('community')
      return
    }
    if ('route' in item && item.route) {
      openAcademic(item.route)
      return
    }
    if ('module' in item && item.module) {
      if (['market', 'errands', 'carpool'].includes(item.module)) {
        void openLifeHub(item.module as LifeHubSection)
        return
      }
      Taro.showToast({ title: `${item.name}入口配置异常`, icon: 'none' })
    }
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

  const openCalendar = () => {
    void openMiniappModule('calendar', '/pages/calendar/index', { config: runtimeConfig })
  }

  const chooseCampus = async () => {
    const campuses = enabledCampuses(runtimeConfig)
    const tapIndex = await showActionSheetSelection(campuses)
    if (tapIndex === null) return
    const selectedCampus = campuses[tapIndex]
    setCampusName(selectedCampus)
    setBannerIndex(0)
    saveSelectedCampus(selectedCampus)
    setCoursePreview(loadCachedCoursePreview(runtimeConfig, selectedCampus))
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
    const current = homeReactions[key] || {
      liked: item.liked,
      likeCount: item.like_count,
      likedByNicknames: item.liked_by_nicknames,
    }
    try {
      const reaction = current.liked
        ? await fullLifeServicesRepository.unlikeResource(item.source_id, 'campus_circle_post')
        : await fullLifeServicesRepository.likeResource(item.source_id, 'campus_circle_post')
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
  const visibleHomeServices = quickServices.filter((service) => {
    if (isQualificationEdition && migratedHomeServiceKeys.has(service.key)) return false
    const moduleKey = serviceModuleKeys[service.key]
    if (!moduleKey) return false
    return resolveMiniappModule(runtimeConfig, moduleKey, campusName).state === 'enabled'
  })
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
  const scheduleRowCount = coursePreview.items.length + todayCalendarEvents.length
  const scheduleCanScroll = scheduleRowCount > SCHEDULE_SCROLL_VISIBLE_ROWS
  const ongoingCourseIndex = coursePreview.items.findIndex((item) => item.status === 'ongoing')
  const highlightedCourseIndex = ongoingCourseIndex >= 0
    ? ongoingCourseIndex
    : coursePreview.items.length > 0
      ? 0
      : -1
  const todayTask = resolveTodayTask(dailyCheckin, userLevelTasks)
  const holidayCountdown = coursePreview.dayLabel === '假期'
    ? Math.max(1, Math.round(
      (new Date(
        coursePreview.targetDate.getFullYear(),
        coursePreview.targetDate.getMonth(),
        coursePreview.targetDate.getDate(),
      ).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000,
    ))
    : null

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

  const openTodayTask = () => {
    if (!todayTask) return
    if (todayTask.route === '/pages/community/index') {
      void openLifeHub('community')
      return
    }
    void Taro.navigateTo({ url: todayTask.route })
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

  const scheduleTimeline = (
    <View className='schedule-card__timeline'>
      <View className='schedule-card__timeline-line' />
      {coursePreview.items.map((item, index) => (
        <View
          key={`${item.course.id}-${item.startsAt.getTime()}`}
          className={[
            'schedule-card__course-row',
            index === highlightedCourseIndex
              ? 'schedule-card__course-row--active'
              : '',
          ].filter(Boolean).join(' ')}
          ariaRole='button'
          ariaLabel={`查看课表：${item.course.name}`}
          onClick={openSchedule}
        >
          <View className='schedule-card__timeline-marker'>
            <View className='schedule-card__timeline-dot' />
          </View>
          <View className='schedule-card__course-copy'>
            <Text className='schedule-card__course-name'>{item.course.name}</Text>
            <View className='schedule-card__meta'>
              <Text>第 {item.course.startSection}-{item.course.endSection} 节</Text>
              <Text className='schedule-card__meta-divider'>·</Text>
              <Image src={icons.location} mode='aspectFit' />
              <Text>{item.course.location || '地点待定'}</Text>
            </View>
          </View>
        </View>
      ))}
      {todayCalendarEvents.length > 0 && coursePreview.items.length > 0 && (
        <View className='schedule-card__event-divider' />
      )}
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
            <View className='schedule-card__timeline-marker'>
              <View className='schedule-card__timeline-dot schedule-card__timeline-dot--event' />
            </View>
            <View className='schedule-card__course-copy'>
              <View className='today-card__event-title-line'>
                <Text className='schedule-card__course-name'>{event.title}</Text>
                {event.priority === 'important' && <Text className='today-card__important'>重要</Text>}
              </View>
              <View className='today-card__event-date'>
                <Text>{calendarEventDateLabel(event)}</Text>
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
    <View className='campus'>
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
            <Text className='campus__eyebrow'>{academicCalendarLabel}</Text>
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

      <View className='schedule-card today-card motion-enter motion-enter--delay-2'>
        <View className='schedule-card__header'>
          <View className='schedule-card__date'>
            <View className='schedule-card__heading-bar' />
            <Text className='schedule-card__day-label'>
              {coursePreview.dayLabel === '假期' ? '假期中' : coursePreview.dayLabel}
            </Text>
          </View>
          <View
            className='schedule-card__summary'
            ariaRole='button'
            ariaLabel='查看完整校历'
            onClick={openCalendar}
          >
            <Text>校历</Text>
            <Image src={icons.arrow} mode='aspectFit' />
          </View>
        </View>

        {(coursePreview.items.length > 0 || todayCalendarEvents.length > 0) ? (
          <View className='schedule-card__courses'>
            <View className='schedule-card__timeline-scroll'>
              {scheduleCanScroll ? (
                <ScrollView
                  className='schedule-card__scroll'
                  scrollY
                  enhanced
                  showScrollbar={false}
                >
                  {scheduleTimeline}
                </ScrollView>
              ) : scheduleTimeline}
              {scheduleCanScroll && (
                <View
                  className='schedule-card__scroll-cue'
                  ariaRole='img'
                  ariaLabel='课表提醒可以上下滑动查看'
                >
                  <Image
                    className='schedule-card__scroll-cue-arrow schedule-card__scroll-cue-arrow--up'
                    src={icons.arrow}
                    mode='aspectFit'
                  />
                  <Image
                    className='schedule-card__scroll-cue-arrow schedule-card__scroll-cue-arrow--down'
                    src={icons.arrow}
                    mode='aspectFit'
                  />
                </View>
              )}
            </View>
            {coursePreview.hiddenCount > 0 && (
              <View
                className='schedule-card__more'
                ariaRole='button'
                ariaLabel={`查看剩余 ${coursePreview.hiddenCount} 节课程`}
                onClick={openSchedule}
              >
                <Text>还有 {coursePreview.hiddenCount} 节课程</Text>
                <Image src={icons.arrow} mode='aspectFit' />
              </View>
            )}
          </View>
        ) : (
          <View className='schedule-card__empty'>
            <View className='schedule-card__empty-copy'>
              <Text>{coursePreview.emptyText}</Text>
              <Text>{holidayCountdown ? `${holidayCountdown}天后开学` : coursePreview.emptyHint}</Text>
            </View>
          </View>
        )}
      </View>

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

      <View className='service-panel motion-enter motion-enter--delay-3'>
        <View className='service-panel__simple-head'>
          <View className='service-panel__heading'>
            <View className='service-panel__heading-bar' />
            <Text className='service-panel__title'>常用服务</Text>
          </View>
          <View
            className='service-panel__all'
            ariaRole='button'
            ariaLabel='查看全部服务'
            onClick={openAllServices}
          >
            <Text>全部</Text>
            <Image src={icons.arrow} mode='aspectFit' />
          </View>
        </View>
        <View className='service-panel__home-grid'>
          {visibleHomeServices.map((item) => (
            <View
              key={item.key}
              className={`service-panel__grid-item service-panel__grid-item--${item.tone} service-panel__grid-item--key-${item.key}`}
              ariaRole='button'
              ariaLabel={item.name}
              onClick={() => openQuickService(item)}
            >
              <View className='service-panel__grid-icon'>
                <Image src={homeServiceIcons[campusTheme][item.iconKey]} mode='aspectFit' />
              </View>
              <Text className='service-panel__grid-name'>{item.name}</Text>
            </View>
          ))}
        </View>
      </View>

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
          <View className='official-notices-home__empty' onClick={openOfficialNotices}>
            暂无最新通知，点击进入通知中心
          </View>
        ) : officialNotices.map((item) => (
          <View
            key={item.id}
            className='official-notices-home__item'
            ariaRole='button'
            ariaLabel={`查看通知：${item.title}`}
            onClick={() => openOfficialNotice(item)}
          >
            <View className='official-notices-home__icon'>
              <Image src={icons.campaign} mode='aspectFit' />
            </View>
            <View className='official-notices-home__copy'>
              <Text className='official-notices-home__copy-title'>{item.title}</Text>
              <View className='official-notices-home__meta'>
                <Text className='official-notices-home__source'>
                  {officialNoticeSourceLabels[item.source]}
                </Text>
                <Text className='official-notices-home__publisher'>{item.publisher}</Text>
                <Text className='official-notices-home__meta-separator'>·</Text>
                <Text className='official-notices-home__date'>
                  {formatOfficialNoticeCompactDate(item.source_published_at)}
                </Text>
              </View>
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
      <View
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
      </View>

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
          {!momentsLoading && momentsError && (
            <View className='home-section-state home-section-state--error' onClick={() => void loadHome()}>
              动态加载失败，点击重试
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
      </>)}

    </View>
  )
}

export default Index
