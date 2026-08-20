import { useCallback, useEffect, useState } from 'react'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import {
  Image,
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
  CampusCirclePostView,
  CampusCircleSectionView,
  MarketplaceListingView,
  CalendarReminderView,
  DailyCheckinStatus,
  UserLevelTask,
} from '../../api/types'
import CustomNavbar from '../../components/custom-navbar'
import UserAvatar from '../../components/user-avatar'
import { saveCommunityFeedPin } from '../../features/community/feed-pin'
import { showActionSheetSelection } from '../../utils/action-sheet'
import { isQualificationEdition } from '../../features/app-edition'
import { openMigratedFeaturePage } from '../../features/app-edition/navigation'
import {
  avatarText,
  resolveCoursePreview,
} from '../../features/home/data'
import {
  communityAuthorAvatarUrl,
  communityAuthorInitial,
  communityAuthorName,
} from '../../features/community/author'
import { plainStickerContent } from '../../features/stickers/content'
import { formatMoney } from '../../features/life-services/format'
import {
  communitySectionNamesById,
  formatHomeMomentsTime,
  homeMomentsBusinessLabels,
} from '../../features/home/moments'
import { campusLabel } from '../../features/life-services/campus'
import { noticesRepository } from '../../features/notices/repository'
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
import { apiDateTimeTimestamp } from '../../utils/date-time'
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
import './index.scss'

const fullLifeServicesRepository = __CAMPUS_APP_EDITION__ === 'qualification'
  ? null
  : require('../../features/life-services/repository').lifeServicesRepository as typeof import('../../features/life-services/repository').lifeServicesRepository

const fullMarketplaceNavigation = __CAMPUS_APP_EDITION__ === 'qualification'
  ? null
  : {
      requestSubscription: require('../../features/wechat-subscription').requestWechatSubscriptionForModule as typeof import('../../features/wechat-subscription').requestWechatSubscriptionForModule,
      saveSnapshot: require('../../features/life-services/business-detail-snapshot').saveBusinessDetailSnapshot as typeof import('../../features/life-services/business-detail-snapshot').saveBusinessDetailSnapshot,
    }

const icons = {
  bell: require('../../assets/icons/bell.svg'),
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
  comment: require('../../assets/community/comment.svg'),
  heart: require('../../assets/community/heart.svg'),
  clubs: require('../../assets/icons/clubs.svg'),
  campusCard: require('../../assets/icons/campus-card.svg'),
  campaign: require('../../assets/icons/campaign.svg'),
}

const homeFeatureFlags = {
  todayTask: false,
} as const

const quickServices = [
  {
    key: 'schedule',
    name: '课程表',
    icon: icons.calendar,
    tone: 'mint',
    route: '/pages/academic/schedule/index',
  },
  {
    key: 'grades',
    name: '成绩',
    icon: icons.grade,
    tone: 'blue',
    route: '/pages/academic/grades/index',
  },
  {
    key: 'exams',
    name: '考试',
    icon: icons.exam,
    tone: 'sand',
    route: '/pages/academic/exams/index',
  },
  { key: 'result', name: '选课结果', icon: icons.result, tone: 'orange', route: '/pages/academic/selection/index' },
  { key: 'pass-rate', name: '通过率', icon: icons.passRate, tone: 'cyan', route: '/pages/academic/statistics/courses' },
  { key: 'materials', name: '资料', icon: icons.materials, tone: 'green', route: '/pages/materials/index' },
  { key: 'calendar', name: '校历', icon: icons.calendar, tone: 'pink', route: '/pages/calendar/index' },
  { key: 'shuttle', name: '校车', icon: icons.shuttle, tone: 'blue', route: '/pages/shuttle/index' },
  { key: 'community', name: '社区', icon: icons.community, tone: 'purple', tab: '/pages/community/index' },
  { key: 'market', name: '二手', icon: icons.market, tone: 'orange', module: 'market' },
  { key: 'errands', name: '跑腿', icon: icons.errands, tone: 'blue', module: 'errands' },
  { key: 'carpool', name: '找同行', icon: icons.shuttle, tone: 'cyan', module: 'carpool' },
  { key: 'classroom', name: '空教室', icon: icons.academic, tone: 'mint', route: '/pages/empty-classroom/index' },
  { key: 'campus-card', name: '校园卡', icon: icons.campusCard, tone: 'blue', route: '/pages/campus-service/index?type=campus-card' },
  { key: 'clubs', name: '社团', icon: icons.clubs, tone: 'green', route: '/pages/clubs/index' },
]

const homeServiceKeys = new Set([
  'schedule',
  'grades',
  'exams',
  'result',
  'materials',
  'calendar',
  'errands',
  'carpool',
  'classroom',
  'campus-card',
])
const homeServices = quickServices.filter((item) => homeServiceKeys.has(item.key))
const migratedHomeServiceKeys = new Set([
  'materials',
  'community',
  'market',
  'errands',
  'carpool',
  'clubs',
])
const serviceFeatureKeys: Record<string, string> = {
  classroom: 'classroom',
  shuttle: 'shuttle',
  'campus-card': 'campus_card',
}
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
}
const lifeSectionModules: Record<LifeHubSection, MiniappModuleKey> = {
  community: 'community',
  errands: 'errand',
  market: 'marketplace',
  carpool: 'carpool',
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
  academicStorage.setScheduleCache(
    userId,
    periods,
    coursesByPeriod,
    coursesUpdatedAtByPeriod,
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
        academicStorage.setScheduleCache(
          userId,
          periods,
          coursesByPeriod,
          coursesUpdatedAtByPeriod,
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

const latestCommunityPosts = (items: CampusCirclePostView[]) => (
  [...items]
    .filter((item) => item.status === 'approved')
    .sort((left, right) => (
      apiDateTimeTimestamp(right.published_at || right.created_at)
      - apiDateTimeTimestamp(left.published_at || left.created_at)
    ))
    .slice(0, 4)
)

const communityPostPreviewText = (post: CampusCirclePostView) => (
  plainStickerContent(post.content || '').trim() || '分享了一组校园图片'
)

const communityPostPreviewImages = (post: CampusCirclePostView) => (
  post.images.filter((image) => !!image.url).slice(0, 3)
)

const marketplaceListingPreviewText = (item: MarketplaceListingView) => {
  const description = plainStickerContent(item.description).trim() || '发布了一件校内闲置'
  return [description, formatMoney(item.price_cents), campusLabel(item.campus)]
    .filter(Boolean)
    .join(' · ')
}

type HomeMomentsFeedItem =
  | { kind: 'community'; key: string; timestamp: number; item: CampusCirclePostView }
  | { kind: 'marketplace'; key: string; timestamp: number; item: MarketplaceListingView }

const buildHomeMomentsFeed = (
  communityItems: CampusCirclePostView[],
  marketplaceItems: MarketplaceListingView[],
) => [
  ...communityItems.map((item): HomeMomentsFeedItem => ({
    kind: 'community',
    key: `community-${item.id}`,
    timestamp: apiDateTimeTimestamp(item.published_at || item.created_at),
    item,
  })),
  ...marketplaceItems.map((item): HomeMomentsFeedItem => ({
    kind: 'marketplace',
    key: `marketplace-${item.id}`,
    timestamp: apiDateTimeTimestamp(item.created_at),
    item,
  })),
]
  .sort((left, right) => right.timestamp - left.timestamp)
  .slice(0, 6)

function Index() {
  useCampusShare(() => ({
    title: '海大校园｜一站式校园生活',
    path: '/pages/index/index',
  }))

  const [runtimeConfig, setRuntimeConfig] = useState(getMiniappRuntimeConfig)
  const [campusName, setCampusName] = useState(() => (
    getSelectedCampus(getMiniappRuntimeConfig())
  ))
  const [username, setUsername] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarUserId, setAvatarUserId] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)
  const [communityPosts, setCommunityPosts] = useState<CampusCirclePostView[]>([])
  const [communitySectionNames, setCommunitySectionNames] = useState<Record<number, string>>({})
  const [marketItems, setMarketItems] = useState<MarketplaceListingView[]>([])
  const [officialNotices, setOfficialNotices] = useState<OfficialNotice[]>([])
  const [calendar, setCalendar] = useState<Awaited<ReturnType<typeof loadAcademicCalendar>>['calendar']>(null)
  const [calendarReminders, setCalendarReminders] = useState<CalendarReminderView[]>([])
  const [dailyCheckin, setDailyCheckin] = useState<DailyCheckinStatus | null>(null)
  const [userLevelTasks, setUserLevelTasks] = useState<UserLevelTask[]>([])
  const [communityLoading, setCommunityLoading] = useState(true)
  const [marketLoading, setMarketLoading] = useState(true)
  const [communityError, setCommunityError] = useState(false)
  const [marketError, setMarketError] = useState(false)
  const [coursePreview, setCoursePreview] = useState(() => (
    loadCachedCoursePreview(runtimeConfig, campusName)
  ))
  const [academicCalendarLabel, setAcademicCalendarLabel] = useState(
    loadCachedAcademicLabel,
  )
  const [bannerIndex, setBannerIndex] = useState(0)
  const headerCollapsed = useCollapsingHeader({
    triggerSelector: '.campus__eyebrow',
    threshold: 48,
    releaseGap: 16,
  })

  const loadHome = useCallback(async (force = false) => {
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
    const communityPromise = !isQualificationEdition
      && fullLifeServicesRepository
      && moduleEnabled('community')
      ? settle(fullLifeServicesRepository.listCampusCirclePosts({ page: 1, pageSize: 8 }))
      : Promise.resolve({ ok: false } as Settled<never>)
    const communitySectionsPromise = !isQualificationEdition
      && fullLifeServicesRepository
      && moduleEnabled('community')
      ? settle(fullLifeServicesRepository.listCampusCircleSections())
      : Promise.resolve({ ok: false } as Settled<never>)
    const marketplacePromise = !isQualificationEdition
      && fullLifeServicesRepository
      && moduleEnabled('marketplace')
      ? settle(fullLifeServicesRepository.listMarketplace({ page: 1, pageSize: 4 }))
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
      community,
      communitySections,
      unread,
      marketplace,
      latestAcademic,
      latestOfficialNotices,
      latestCalendar,
      latestCheckin,
      latestTasks,
      latestReminders,
    ] = await Promise.all([
      accountPromise,
      communityPromise,
      communitySectionsPromise,
      settle(noticesRepository.unreadCount()),
      marketplacePromise,
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
    ))
    if (account.ok) {
      setUsername(account.value.user.username)
      setAvatarUrl(account.value.user.avatar_url || '')
      setAvatarUserId(account.value.user.id)
    }
    setAcademicCalendarLabel(getAcademicCalendarLabel(latestAcademic?.periods || []))
    if (community.ok) {
      setCommunityPosts(latestCommunityPosts(community.value.items))
      setCommunityError(false)
    } else {
      setCommunityPosts([])
      setCommunityError(moduleEnabled('community'))
    }
    setCommunitySectionNames(
      communitySections.ok
        ? communitySectionNamesById(communitySections.value.items as CampusCircleSectionView[])
        : {},
    )
    if (unread.ok) setUnreadCount(Number(unread.value.count) || 0)
    if (marketplace.ok) {
      setMarketItems(marketplace.value.items)
      setMarketError(false)
    } else {
      setMarketItems([])
      setMarketError(moduleEnabled('marketplace'))
    }
    setOfficialNotices(latestOfficialNotices.ok ? latestOfficialNotices.value.items : [])
    setCalendar(latestCalendar.calendar)
    setDailyCheckin(latestCheckin.ok ? latestCheckin.value : null)
    setUserLevelTasks(latestTasks.ok ? latestTasks.value.items : [])
    setCalendarReminders(latestReminders.ok ? latestReminders.value.items : [])
    setCommunityLoading(false)
    setMarketLoading(false)
    Taro.stopPullDownRefresh()
  }, [])

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

  const openCommunityPost = (item: CampusCirclePostView) => {
    saveCommunityFeedPin(item)
    void openLifeHub('community')
  }

  const openMarketplaceListing = (item: MarketplaceListingView) => {
    if (!fullMarketplaceNavigation) return
    fullMarketplaceNavigation.requestSubscription('marketplace')
    fullMarketplaceNavigation.saveSnapshot('marketplace', item)
    void Taro.navigateTo({
      url: `/packages/social/marketplace/detail?id=${item.id}&snapshot=1`,
    })
  }

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
  const campusConfig = runtimeConfig.campuses[campusName]
  const visibleHomeServices = homeServices.filter((service) => {
    if (isQualificationEdition && migratedHomeServiceKeys.has(service.key)) return false
    const featureKey = serviceFeatureKeys[service.key]
    const moduleKey = serviceModuleKeys[service.key]
    return (
      (!featureKey || !campusConfig || campusConfig.features[featureKey] !== false)
      && (!moduleKey
        || resolveMiniappModule(runtimeConfig, moduleKey, campusName).state !== 'hidden')
    )
  })
  const migrationGuide = getMigrationGuideCopy(runtimeConfig)
  const homeMomentsFeed = buildHomeMomentsFeed(communityPosts, marketItems)
  const momentsLoading = communityLoading || marketLoading
  const momentsError = (communityError || marketError) && homeMomentsFeed.length === 0
  const todayCalendarEvents = upcomingHomeCalendarEvents(calendar, campusName)
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

  return (
    <View className='campus'>
      <CustomNavbar
        title='海大校园'
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
              hoverClass='campus__school--pressed'
              ariaRole='button'
              ariaLabel={`切换校区，当前为${campusName}`}
              onClick={chooseCampus}
            >
              <Text>{campusName}</Text>
              <Image className='campus__chevron' src={icons.arrow} mode='aspectFit' />
            </View>
          </View>
        </View>
        <View className='campus__header-actions'>
          <View
            className='icon-button motion-press'
            hoverClass='motion-press--active'
            hoverStartTime={20}
            hoverStayTime={100}
            ariaRole='button'
            ariaLabel={unreadCount > 0 ? `消息，${unreadCount} 条未读` : '消息'}
            onClick={() => Taro.switchTab({ url: '/pages/messages/index' })}
          >
            <Image src={icons.bell} mode='aspectFit' />
            {unreadCount > 0 && <View className='icon-button__dot' />}
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
            hoverClass='schedule-card__summary--pressed'
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
            {coursePreview.items.map((item, index) => (
              <View
                key={`${item.course.id}-${item.startsAt.getTime()}`}
                className={[
                  'schedule-card__course-row',
                  item.status === 'ongoing'
                    ? 'schedule-card__course-row--ongoing'
                    : '',
                ].filter(Boolean).join(' ')}
                hoverClass='today-card__row--pressed'
                ariaRole='button'
                ariaLabel={`查看课表：${item.course.name}`}
                onClick={openSchedule}
              >
                <Text className='schedule-card__section'>
                  第 {item.course.startSection}-{item.course.endSection} 节
                </Text>
                <View className='schedule-card__course-copy'>
                  <Text className='schedule-card__course-name'>
                    {item.course.name}
                  </Text>
                  <View className='schedule-card__meta'>
                    <Image src={icons.location} mode='aspectFit' />
                    <Text>{item.course.location || '地点待定'}</Text>
                    {item.status === 'ongoing' && (
                      <Text>· {item.statusText}</Text>
                    )}
                  </View>
                </View>
                {item.status === 'ongoing' && (
                  <Text className='schedule-card__state'>上课中</Text>
                )}
                {item.status === 'upcoming'
                  && coursePreview.dayLabel === '今天'
                  && index === 0
                  && (
                    <Text className='schedule-card__state schedule-card__state--next'>
                      下一节
                    </Text>
                  )}
              </View>
            ))}
            {todayCalendarEvents.map((event) => {
              const reminder = calendarReminders.find((item) => item.event_id === event.id)
              return (
                <View
                  key={`calendar-${event.id}`}
                  className={[
                    'schedule-card__course-row',
                    'today-card__event-row',
                    event.priority === 'important' ? 'today-card__event-row--important' : '',
                  ].filter(Boolean).join(' ')}
                  hoverClass='today-card__row--pressed'
                  ariaRole='button'
                  ariaLabel={`查看校历：${event.title}`}
                  onClick={openCalendar}
                >
                  <View className='today-card__event-date'>
                    <Text>{calendarEventDateLabel(event)}</Text>
                    <Text>{event.type === 'registration' ? '教务' : '校历'}</Text>
                  </View>
                  <View className='schedule-card__course-copy'>
                    <View className='today-card__event-title-line'>
                      <Text className='schedule-card__course-name'>{event.title}</Text>
                      {event.priority === 'important' && <Text className='today-card__important'>重要</Text>}
                    </View>
                    <View className='schedule-card__meta'>
                      <Text>{event.description || '查看校历详情'}</Text>
                    </View>
                  </View>
                  {event.remindable && (
                    <View
                      className={[
                        'today-card__reminder',
                        reminder ? 'today-card__reminder--active' : '',
                      ].filter(Boolean).join(' ')}
                      hoverClass='today-card__reminder--pressed'
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
          hoverClass='today-task--pressed'
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
            hoverClass='service-panel__all--pressed'
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
              hoverClass='service-panel__item--pressed'
              ariaRole='button'
              ariaLabel={item.name}
              onClick={() => openQuickService(item)}
            >
              <View className='service-panel__grid-icon'>
                <Image src={item.icon} mode='aspectFit' />
              </View>
              <Text className='service-panel__grid-name'>{item.name}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className='official-notices-home motion-enter motion-enter--delay-4'>
        <View
          className='official-notices-home__head'
          hoverClass='official-notices-home__head--pressed'
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
            hoverClass='official-notices-home__item--pressed'
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
            hoverClass='home-migrated__action--pressed'
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
        hoverClass='motion-press--active'
        hoverStartTime={20}
        hoverStayTime={100}
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
            hoverClass='moments-panel__more--pressed'
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
          {!momentsLoading && !momentsError && homeMomentsFeed.length === 0 && (
            <View className='home-section-state'>暂时没有校园动态</View>
          )}
          {!momentsLoading && homeMomentsFeed.map((entry, index) => {
            const communityItem = entry.kind === 'community' ? entry.item : null
            const marketplaceItem = entry.kind === 'marketplace' ? entry.item : null
            const authorName = communityItem
              ? communityAuthorName(communityItem)
              : marketplaceItem?.author_nickname?.trim() || `发布者 #${marketplaceItem?.owner_id}`
            const authorAvatarUrl = communityItem
              ? communityAuthorAvatarUrl(communityItem)
              : marketplaceItem?.author_avatar_url
            const authorId = communityItem?.author_deleted
              ? 0
              : communityItem?.author_id || marketplaceItem?.owner_id || 0
            const images = communityItem
              ? communityPostPreviewImages(communityItem).map((image) => ({
                  key: `community-image-${image.id}`,
                  url: image.url,
                }))
              : (marketplaceItem?.image_urls || []).filter(Boolean).slice(0, 3).map((url, imageIndex) => ({
                  key: `marketplace-image-${entry.item.id}-${imageIndex}`,
                  url,
                }))
            const content = communityItem
              ? communityPostPreviewText(communityItem)
              : marketplaceListingPreviewText(entry.item as MarketplaceListingView)
            const publishedAt = communityItem
              ? communityItem.published_at || communityItem.created_at
              : marketplaceItem?.created_at
            const sectionLabel = communityItem
              ? communitySectionNames[communityItem.section_id] || '校园动态'
              : homeMomentsBusinessLabels.marketplace

            return (
              <View
                key={entry.key}
                className={[
                  'moments-feed__item',
                  'motion-enter',
                  `motion-enter--delay-${Math.min(index + 1, 4)}`,
                ].join(' ')}
                hoverClass='moments-feed__item--pressed'
                hoverStartTime={20}
                hoverStayTime={120}
                ariaRole='button'
                ariaLabel={`查看${authorName}发布的${entry.kind === 'community' ? '动态' : '二手信息'}`}
                onClick={() => communityItem
                  ? openCommunityPost(communityItem)
                  : marketplaceItem && openMarketplaceListing(marketplaceItem)}
              >
                <UserAvatar
                  src={authorAvatarUrl}
                  className='moments-feed__avatar'
                  imageClassName='moments-feed__avatar-image'
                  fallback={communityItem
                    ? communityAuthorInitial(communityItem)
                    : authorName.slice(0, 1) || '同'}
                  userId={authorId}
                  lazyLoad
                />

                <View className='moments-feed__main'>
                  <Text className='moments-feed__name'>{authorName}</Text>
                  <Text className='moments-feed__text'>{content}</Text>

                  {images.length > 0 && (
                    <View className={`moments-feed__media moments-feed__media--${images.length}`}>
                      {images.map((image, imageIndex) => (
                        <Image
                          key={image.key}
                          className='moments-feed__image'
                          src={image.url}
                          mode='aspectFill'
                          lazyLoad
                          ariaLabel={`${entry.kind === 'community' ? '动态' : '二手'}图片 ${imageIndex + 1}/${images.length}`}
                        />
                      ))}
                    </View>
                  )}

                  <View className='moments-feed__meta'>
                    <Text className='moments-feed__meta-copy'>
                      {formatHomeMomentsTime(publishedAt)} · {sectionLabel}
                    </Text>
                    <View className='moments-feed__action'>
                      <View />
                      <View />
                    </View>
                  </View>

                  {communityItem && (communityItem.like_count > 0 || communityItem.comment_count > 0) && (
                    <View className='moments-feed__social'>
                      {communityItem.like_count > 0 && (
                        <View className='moments-feed__social-row moments-feed__social-row--like'>
                          <Image src={icons.heart} mode='aspectFit' />
                          <Text>{communityItem.like_count} 人赞过</Text>
                        </View>
                      )}
                      {communityItem.comment_count > 0 && (
                        <View className='moments-feed__social-row moments-feed__social-row--comments'>
                          <Text>查看全部 {communityItem.comment_count} 条评论</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </View>
            )
          })}
        </View>
      </View>
      </>)}

    </View>
  )
}

export default Index
