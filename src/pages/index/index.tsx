import { useCallback, useEffect, useState } from 'react'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
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
  CampusCirclePostView,
  CampusCircleSectionView,
  MarketplaceListingView,
  CalendarReminderView,
  DailyCheckinStatus,
  UserLevelTask,
} from '../../api/types'
import CustomNavbar from '../../components/custom-navbar'
import { saveCommunityFeedPin } from '../../features/community/feed-pin'
import { isQualificationEdition } from '../../features/app-edition'
import { openMigratedFeaturePage } from '../../features/app-edition/navigation'
import {
  avatarText,
  resolveCoursePreview,
} from '../../features/home/data'
import {
  communityAuthorInitial,
  communityAuthorName,
  communityAuthorTone,
} from '../../features/community/author'
import { formatDateTime } from '../../features/life-services/format'
import { noticesRepository } from '../../features/notices/repository'
import { officialNoticesRepository } from '../../features/official-notices/repository'
import {
  formatOfficialNoticeDate,
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
import './index.scss'

const fullLifeServicesRepository = __CAMPUS_APP_EDITION__ === 'qualification'
  ? null
  : require('../../features/life-services/repository').lifeServicesRepository as typeof import('../../features/life-services/repository').lifeServicesRepository

const FullMarketplaceCard = __CAMPUS_APP_EDITION__ === 'qualification'
  ? null
  : require('../../features/life-services/components/marketplace-card').default as typeof import('../../features/life-services/components/marketplace-card').default

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
  { key: 'clubs', name: '社团', icon: icons.clubs, tone: 'green', route: '/pages/clubs/index' },
]

const homeServiceKeys = new Set([
  'schedule',
  'grades',
  'exams',
  'result',
  'pass-rate',
  'materials',
  'calendar',
  'shuttle',
  'community',
  'market',
  'errands',
  'carpool',
  'clubs',
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
) => {
  const periodsResult = await settle(academicRepository.getPeriods())
  if (!periodsResult.ok || !periodsResult.value.length) return cache

  const periods = periodsResult.value
  let coursesByPeriod = cache ? cache.coursesByPeriod : {}
  academicStorage.setScheduleCache(userId, periods, coursesByPeriod)

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
        coursesByPeriod = setCoursesForPeriod(
          coursesByPeriod,
          periodId,
          requireCoursesForPeriod(coursesResult.value, periodId),
        )
        academicStorage.setScheduleCache(userId, periods, coursesByPeriod)
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
  } satisfies AcademicScheduleCache
}

const loadHomeAcademic = async (accountPromise: Promise<Settled<Awaited<ReturnType<typeof getCurrentUser>>>>) => {
  const account = await accountPromise
  const userId = account.ok ? account.value.user.id : getActiveAcademicUserId()
  const cache = academicStorage.getScheduleCache(userId)
  if (!account.ok) return cache

  const verification = await settle(getAcademicVerificationStatus())
  if (!verification.ok || verification.value.identity?.status !== 'verified') return cache
  return loadLatestAcademic(userId, cache)
}

const latestCommunityPosts = (items: CampusCirclePostView[]) => (
  [...items]
    .filter((item) => item.status === 'approved')
    .sort((left, right) => (
      apiDateTimeTimestamp(right.published_at || right.created_at)
      - apiDateTimeTimestamp(left.published_at || left.created_at)
    ))
    .slice(0, 3)
)

const communitySectionNames = (sections: CampusCircleSectionView[]) => (
  sections.reduce<Record<number, string>>((names, section) => {
    names[section.id] = section.name
    section.children.forEach((child) => {
      names[child.id] = child.name
    })
    return names
  }, {})
)

function Index() {
  const [runtimeConfig, setRuntimeConfig] = useState(getMiniappRuntimeConfig)
  const [campusName, setCampusName] = useState(() => (
    getSelectedCampus(getMiniappRuntimeConfig())
  ))
  const [username, setUsername] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const [communityPosts, setCommunityPosts] = useState<CampusCirclePostView[]>([])
  const [sectionNames, setSectionNames] = useState<Record<number, string>>({})
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

  const loadHome = useCallback(async () => {
    const latestRuntimeConfig = await loadMiniappRuntimeConfig()
    const moduleEnabled = (key: MiniappModuleKey) => (
      resolveMiniappModule(latestRuntimeConfig, key).state === 'enabled'
    )
    const accountPromise = settle(getCurrentUser())
    // 未认证用户只展示缓存；已认证用户才在后台刷新教务数据。
    const academicPromise = moduleEnabled('academic_schedule')
      ? loadHomeAcademic(accountPromise)
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
      ? settle(fullLifeServicesRepository.listMarketplace({ page: 1, pageSize: 2 }))
      : Promise.resolve({ ok: false } as Settled<never>)
    const officialNoticesPromise = settle(officialNoticesRepository.feed({
      pageSize: 2,
    }))
    const calendarPromise = moduleEnabled('calendar')
      ? loadAcademicCalendar(getCalendarEducationLevel())
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
    if (account.ok) setUsername(account.value.user.username)
    setAcademicCalendarLabel(getAcademicCalendarLabel(latestAcademic?.periods || []))
    if (community.ok) {
      setCommunityPosts(latestCommunityPosts(community.value.items))
      setCommunityError(false)
    } else {
      setCommunityPosts([])
      setCommunityError(moduleEnabled('community'))
    }
    if (communitySections.ok) {
      setSectionNames(communitySectionNames(communitySections.value.items))
    }
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
    void loadHome()
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

  const openModule = (type: string) => {
    if (['community', 'errands', 'market', 'carpool'].includes(type)) {
      void openLifeHub(type as LifeHubSection)
      return
    }
    Taro.showToast({ title: '服务入口已更新', icon: 'none' })
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
    const result = await Taro.showActionSheet({ itemList: campuses })
    if (typeof result.tapIndex !== 'number') return
    const selectedCampus = campuses[result.tapIndex]
    setCampusName(selectedCampus)
    setBannerIndex(0)
    saveSelectedCampus(selectedCampus)
    setCoursePreview(loadCachedCoursePreview(runtimeConfig, selectedCampus))
  }

  const openCommunityPost = (item: CampusCirclePostView) => {
    saveCommunityFeedPin(item)
    void openLifeHub('community')
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
  const visibleCommunityPosts = communityPosts.slice(0, 3)
  const todayCalendarEvents = upcomingHomeCalendarEvents(calendar, campusName)
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
      <View className='campus__orb campus__orb--one' />
      <View className='campus__orb campus__orb--two' />

      <CustomNavbar
        title='海大校园'
        immersive
        compactImmersive
        collapsed={headerCollapsed}
      />

      <View className='campus__header motion-enter'>
        <View className='campus__identity'>
          <View className='campus__avatar'>
            <Text>{avatarText(username)}</Text>
            <View className='campus__online' />
          </View>
          <View className='campus__identity-copy'>
            <Text className='campus__eyebrow'>{academicCalendarLabel}</Text>
            <View
              className='campus__school'
              hoverClass='campus__school--pressed'
              ariaRole='button'
              ariaLabel={`切换校区，当前为${campusName}`}
              onClick={chooseCampus}
            >
              <Text>中国海洋大学 · {campusName}</Text>
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
            <Text className='schedule-card__day-label'>今天</Text>
            <Text className='schedule-card__date-label'>{coursePreview.dateLabel}</Text>
          </View>
          <View
            className='schedule-card__summary'
            hoverClass='schedule-card__summary--pressed'
            ariaRole='button'
            ariaLabel='查看完整校历'
            onClick={openCalendar}
          >
            <Text>全部日程</Text>
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
            <Text>今天没有待办日程</Text>
            <Text>课程、考试和推荐校历事件会汇总在这里</Text>
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
          <View className='service-panel__title-group'>
            <Text className='service-panel__title'>常用服务</Text>
            <Text className='service-panel__subtitle'>学习生活，一触即达</Text>
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
              className={`service-panel__grid-item service-panel__grid-item--${item.tone}`}
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
          <View>
            <Text className='official-notices-home__eyebrow'>OFFICIAL</Text>
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
            onClick={() => openOfficialNotice(item)}
          >
            <View className='official-notices-home__source'>
              {officialNoticeSourceLabels[item.source]}
            </View>
            <View className='official-notices-home__copy'>
              <Text>{item.title}</Text>
              <Text>{item.publisher} · {formatOfficialNoticeDate(item.source_published_at)}</Text>
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
        ariaLabel={runtimeBanner?.title || '发现校园新鲜事'}
        onClick={() => runtimeBanner
          ? openRuntimeBanner(runtimeBanner)
          : openModule('community')}
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
            <Text>{runtimeBanner ? '校园推荐' : '今日校园'}</Text>
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
                title: '海纳百川，取则行远',
                subtitle: '一站式连接海大学习与生活',
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
              <Text>{runtimeBanner ? '查看详情' : '发现校园新鲜事'}</Text>
              <Image src={icons.arrow} mode='aspectFit' />
            </View>
          )}
        </View>
        {!runtimeBanner?.image_url && (
          <View className='hero-card__art'>
            <View className='hero-card__sun' />
            <View className='hero-card__cloud hero-card__cloud--one' />
            <View className='hero-card__cloud hero-card__cloud--two' />
            <View className='hero-card__building'>
              <View className='hero-card__roof' />
              <View className='hero-card__windows'>
                <View /><View /><View />
              </View>
            </View>
            <View className='hero-card__tree hero-card__tree--one' />
            <View className='hero-card__tree hero-card__tree--two' />
          </View>
        )}
      </View>

      <View className='community-panel'>
        <View className='section-heading section-heading--community'>
          <View>
            <Text className='section-heading__eyebrow'>CAMPUS</Text>
            <Text className='section-heading__title'>校园新鲜事</Text>
          </View>
          <View
            className='section-heading__more'
            hoverClass='section-heading__more--pressed'
            ariaRole='button'
            ariaLabel='查看更多校园动态'
            onClick={() => openLifeHub('community')}
          >
            <Text>查看更多</Text>
            <Image src={icons.arrow} mode='aspectFit' />
          </View>
        </View>

        <View className='news-card'>
        {communityLoading && <View className='home-section-state'>正在加载校园动态</View>}
        {!communityLoading && communityError && (
          <View className='home-section-state home-section-state--error' onClick={() => void loadHome()}>
            动态加载失败，点击重试
          </View>
        )}
        {!communityLoading && !communityError && visibleCommunityPosts.length === 0 && (
          <View className='home-section-state'>暂时没有校园动态</View>
        )}
        {!communityLoading && !communityError && visibleCommunityPosts.map((item, index) => (
          <View
            key={item.id}
            className={[
              'news-card__item',
              'motion-enter',
              `motion-enter--delay-${Math.min(index + 1, 4)}`,
              index === 0 ? 'news-card__item--featured' : 'news-card__item--compact',
            ].join(' ')}
            hoverClass='news-card__item--pressed'
            hoverStartTime={20}
            hoverStayTime={120}
            ariaRole='button'
            ariaLabel={`查看${communityAuthorName(item)}发布的动态`}
            onClick={() => openCommunityPost(item)}
          >
            {index === 0 ? (<>
              <View className='news-card__topline'>
                <View className={`news-card__avatar news-card__avatar--tone-${communityAuthorTone(item)}`}>
                  <Text>{communityAuthorInitial(item)}</Text>
                </View>
                <View className='news-card__author'>
                  <Text className='news-card__author-name'>{communityAuthorName(item)}</Text>
                  <Text className='news-card__time'>
                    {formatDateTime(item.published_at || item.created_at)}
                  </Text>
                </View>
                <View className='news-card__tag'>
                  <Text>{sectionNames[item.section_id] || '社区'}</Text>
                </View>
              </View>

              <View className='news-card__body'>
                <Text className='news-card__title'>
                  {item.content?.trim() || '分享了一组校园图片'}
                </Text>
                {item.images[0] && (
                  <Image
                    className='news-card__cover'
                    src={item.images[0].url}
                    mode='aspectFill'
                    lazyLoad
                  />
                )}
              </View>

              <View className='news-card__footer'>
                <View className='news-card__metric'>
                  <Image src={icons.heart} mode='aspectFit' />
                  <Text>{item.like_count}</Text>
                </View>
                <View className='news-card__metric'>
                  <Image src={icons.comment} mode='aspectFit' />
                  <Text>{item.comment_count}</Text>
                </View>
                <View className='news-card__read'>
                  <Text>去看看</Text>
                  <Image src={icons.arrow} mode='aspectFit' />
                </View>
              </View>
            </>) : (
              <View className='news-card__compact-main'>
                <View className={`news-card__avatar news-card__avatar--tone-${communityAuthorTone(item)}`}>
                  <Text>{communityAuthorInitial(item)}</Text>
                </View>
                <View className='news-card__compact-copy'>
                  <View className='news-card__compact-meta'>
                    <Text>{communityAuthorName(item)} · {sectionNames[item.section_id] || '社区'}</Text>
                    <Text>{formatDateTime(item.published_at || item.created_at)}</Text>
                  </View>
                  <Text className='news-card__compact-title'>
                    {item.content?.trim() || '分享了一组校园图片'}
                  </Text>
                </View>
                <Image className='news-card__compact-arrow' src={icons.arrow} mode='aspectFit' />
              </View>
            )}
          </View>
        ))}
        </View>
      </View>

      <View className='market-panel'>
        <View className='section-heading section-heading--market'>
          <View>
            <Text className='section-heading__eyebrow section-heading__eyebrow--market'>MARKET</Text>
            <Text className='section-heading__title'>同学们在淘</Text>
          </View>
          <View
            className='section-heading__more'
            hoverClass='section-heading__more--pressed'
            ariaRole='button'
            ariaLabel='查看更多二手好物'
            onClick={() => openModule('market')}
          >
            <Text>逛一逛</Text>
            <Image src={icons.arrow} mode='aspectFit' />
          </View>
        </View>

        <ScrollView className='market-scroll' scrollX enhanced showScrollbar={false}>
          <View className='market-list'>
            {marketLoading && <View className='home-section-state home-section-state--market'>正在加载校内闲置</View>}
            {!marketLoading && marketError && (
              <View
                className='home-section-state home-section-state--market home-section-state--error'
                onClick={() => void loadHome()}
              >
                闲置加载失败，点击重试
              </View>
            )}
            {!marketLoading && !marketError && marketItems.length === 0 && (
              <View className='home-section-state home-section-state--market'>暂时没有在售闲置</View>
            )}
            {!marketLoading && !marketError && FullMarketplaceCard && marketItems.map((item) => (
              <FullMarketplaceCard key={item.id} item={item} variant='compact' />
            ))}
            <View
              className='market-card market-card--more'
              hoverClass='market-card--pressed'
              ariaRole='button'
              ariaLabel='查看更多二手好物'
              onClick={() => openModule('market')}
            >
              <View className='market-card__more-icon'>
                <Image src={icons.arrow} mode='aspectFit' />
              </View>
              <Text>查看更多好物</Text>
            </View>
          </View>
        </ScrollView>
      </View>
      </>)}

    </View>
  )
}

export default Index
