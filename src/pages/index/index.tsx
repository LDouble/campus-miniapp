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
import { getActiveAcademicUserId } from '../../api/academic-credential'
import type {
  CampusCirclePostView,
  CampusCircleSectionView,
  MarketplaceListingView,
} from '../../api/types'
import CustomNavbar from '../../components/custom-navbar'
import {
  getCachedAcademicCalendar,
  getCalendarEducationLevel,
  loadAcademicCalendar,
} from '../../features/calendar/repository'
import {
  academicCalendarLabel as getAcademicCalendarLabel,
} from '../../features/calendar/utils'
import { saveCommunityFeedPin } from '../../features/community/feed-pin'
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
import MarketplaceCard from '../../features/life-services/components/marketplace-card'
import { lifeServicesRepository } from '../../features/life-services/repository'
import { noticesRepository } from '../../features/notices/repository'
import {
  activeBanners,
  activeSlogans,
  enabledCampuses,
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
import { academicRepository } from '../academic/repository'
import {
  academicStorage,
  type AcademicScheduleCache,
} from '../academic/storage'
import {
  getCurrentAcademicWeek,
  resolveScheduleAnchor,
} from '../academic/utils'
import { normalizeWebViewUrl } from '../../features/webview/url'
import { syncCustomTabBar } from '../../utils/tabbar'
import './index.scss'

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
}

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
  { key: 'carpool', name: '拼车', icon: icons.shuttle, tone: 'cyan', module: 'carpool' },
  { key: 'classroom', name: '空教室', icon: icons.academic, tone: 'mint', route: '/pages/empty-classroom/index' },
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
])
const homeServices = quickServices.filter((item) => homeServiceKeys.has(item.key))
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
  const result = getCachedAcademicCalendar()
  return getAcademicCalendarLabel(result.calendar)
}

const loadLatestAcademic = async (userIdPromise: Promise<number>) => {
  const periodsPromise = settle(academicRepository.getPeriods())
  const userId = await userIdPromise
  const cache = academicStorage.getScheduleCache(userId)
  const periodsResult = await periodsPromise

  if (!periodsResult.ok || !periodsResult.value.length) {
    return cache
  }

  const periods = periodsResult.value
  let coursesByPeriod = cache ? cache.coursesByPeriod : {}
  academicStorage.setScheduleCache(
    userId,
    periods,
    coursesByPeriod,
  )

  const { periodId } = resolveScheduleAnchor(periods)
  const anchoredPeriod = periods.find((period) => period.id === periodId)
  const isCurrentPeriod = !!anchoredPeriod
    && getCurrentAcademicWeek([anchoredPeriod]) !== null
  const hasCachedCourses = !!periodId
    && Object.prototype.hasOwnProperty.call(coursesByPeriod, periodId)

  if (periodId && isCurrentPeriod && !hasCachedCourses) {
    const coursesResult = await settle(academicRepository.getCourses(periodId))
    if (coursesResult.ok) {
      coursesByPeriod = {
        ...coursesByPeriod,
        [periodId]: coursesResult.value,
      }
      academicStorage.setScheduleCache(userId, periods, coursesByPeriod)
    }
  }

  const latestCache: AcademicScheduleCache = {
    version: 1,
    platformUserId: userId,
    periods,
    coursesByPeriod,
  }
  return latestCache
}

const latestCommunityPosts = (items: CampusCirclePostView[]) => (
  [...items]
    .filter((item) => item.status === 'approved')
    .sort((left, right) => (
      new Date(right.published_at || right.created_at).getTime()
      - new Date(left.published_at || left.created_at).getTime()
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
    const academicUserIdPromise = accountPromise.then((account) => (
      account.ok ? account.value.user.id : getActiveAcademicUserId()
    ))
    const academicPromise = moduleEnabled('academic_schedule')
      ? loadLatestAcademic(academicUserIdPromise)
      : Promise.resolve(academicStorage.getScheduleCache(getActiveAcademicUserId()))
    const calendarPromise = moduleEnabled('calendar')
      ? loadAcademicCalendar(getCalendarEducationLevel())
        .then((result) => getAcademicCalendarLabel(result.calendar))
      : Promise.resolve(loadCachedAcademicLabel())
    const communityPromise = moduleEnabled('community')
      ? settle(lifeServicesRepository.listCampusCirclePosts({ page: 1, pageSize: 8 }))
      : Promise.resolve({ ok: false } as Settled<never>)
    const communitySectionsPromise = moduleEnabled('community')
      ? settle(lifeServicesRepository.listCampusCircleSections())
      : Promise.resolve({ ok: false } as Settled<never>)
    const marketplacePromise = moduleEnabled('marketplace')
      ? settle(lifeServicesRepository.listMarketplace({ page: 1, pageSize: 2 }))
      : Promise.resolve({ ok: false } as Settled<never>)
    const [
      account,
      community,
      communitySections,
      unread,
      marketplace,
      latestAcademic,
      latestCalendarLabel,
    ] = await Promise.all([
      accountPromise,
      communityPromise,
      communitySectionsPromise,
      settle(noticesRepository.unreadCount()),
      marketplacePromise,
      academicPromise,
      calendarPromise,
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
    setAcademicCalendarLabel(latestCalendarLabel)
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
    syncCustomTabBar(0)
    void loadHome()
  })

  usePullDownRefresh(() => {
    setCoursePreview(loadCachedCoursePreview(runtimeConfig, campusName))
    setAcademicCalendarLabel(loadCachedAcademicLabel())
    void loadHome()
  })

  const openLifeHub = async (section: LifeHubSection) => {
    const moduleKey = lifeSectionModules[section]
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

  const banners = activeBanners(runtimeConfig, campusName)
  const runtimeBanner = banners[bannerIndex % Math.max(1, banners.length)] || null
  const slogans = activeSlogans(runtimeConfig, campusName)
  const sloganInterval = Math.min(
    30000,
    Math.max(3000, runtimeConfig.slogan_interval_ms),
  )
  const campusConfig = runtimeConfig.campuses[campusName]
  const visibleHomeServices = homeServices.filter((service) => {
    const featureKey = serviceFeatureKeys[service.key]
    const moduleKey = serviceModuleKeys[service.key]
    return (
      (!featureKey || !campusConfig || campusConfig.features[featureKey] !== false)
      && (!moduleKey
        || resolveMiniappModule(runtimeConfig, moduleKey, campusName).state !== 'hidden')
    )
  })
  const visibleCommunityPosts = communityPosts.slice(0, 3)

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

      <View className='campus__header'>
        <View className='campus__identity'>
          <View className='campus__avatar'>
            <Text>{avatarText(username)}</Text>
            <View className='campus__online' />
          </View>
          <View className='campus__identity-copy'>
            <Text className='campus__eyebrow'>{academicCalendarLabel}</Text>
            <View className='campus__school' onClick={chooseCampus}>
              <Text>中国海洋大学 · {campusName}</Text>
              <Text className='campus__chevron'>⌄</Text>
            </View>
          </View>
        </View>
        <View className='campus__header-actions'>
          <View className='icon-button' onClick={() => Taro.switchTab({ url: '/pages/messages/index' })}>
            <Image src={icons.bell} mode='aspectFit' />
            {unreadCount > 0 && <View className='icon-button__dot' />}
          </View>
        </View>
      </View>

      <View className='schedule-card' onClick={openSchedule}>
        <View className='schedule-card__header'>
          <View className='schedule-card__date'>
            <Text className='schedule-card__day-label'>{coursePreview.dayLabel}</Text>
            <Text className='schedule-card__date-label'>{coursePreview.dateLabel}</Text>
          </View>
          <View className='schedule-card__summary'>
            <Text>{coursePreview.total
              ? `共 ${coursePreview.total} 节`
              : '查看课表'}
            </Text>
            <Image src={icons.arrow} mode='aspectFit' />
          </View>
        </View>

        {coursePreview.items.length > 0 ? (
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
              >
                <Text className='schedule-card__time'>{item.startTime}</Text>
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
          </View>
        ) : (
          <View className='schedule-card__empty'>
            <Text>{coursePreview.emptyText}</Text>
            <Text>{coursePreview.emptyHint}</Text>
          </View>
        )}
      </View>

      <View className='service-panel'>
        <View className='service-panel__simple-head'>
          <Text>校园服务</Text>
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

      <View
        className={[
          'hero-card',
          runtimeBanner ? 'hero-card--notice' : '',
          runtimeBanner?.image_url ? 'hero-card--image' : '',
        ].filter(Boolean).join(' ')}
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

      <View className='section-heading section-heading--compact'>
        <View>
          <Text className='section-heading__title'>校园新鲜事</Text>
          <Text className='section-heading__sub'>看看同学们正在聊什么</Text>
        </View>
        <View className='section-heading__more' onClick={() => openLifeHub('community')}>
          <Text>更多</Text>
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
              index === 0 ? 'news-card__item--featured' : 'news-card__item--compact',
            ].join(' ')}
            hoverClass='news-card__item--pressed'
            hoverStartTime={20}
            hoverStayTime={120}
            ariaRole='button'
            ariaLabel={`查看${communityAuthorName(item)}发布的动态`}
            onClick={() => openCommunityPost(item)}
          >
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
              {index === 0 && item.images[0] && (
                <Image
                  className='news-card__cover'
                  src={item.images[0].url}
                  mode='aspectFill'
                  lazyLoad
                />
              )}
            </View>

            {index === 0 && (
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
            )}
          </View>
        ))}
      </View>

      <View className='section-heading section-heading--compact'>
        <View>
          <Text className='section-heading__title'>同学们在淘</Text>
          <Text className='section-heading__sub'>校内面交，放心又便捷</Text>
        </View>
        <View className='section-heading__more' onClick={() => openModule('market')}>
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
          {!marketLoading && !marketError && marketItems.map((item) => (
            <MarketplaceCard key={item.id} item={item} variant='compact' />
          ))}
          <View className='market-card market-card--more' onClick={() => openModule('market')}>
            <View className='market-card__more-icon'>
              <Image src={icons.arrow} mode='aspectFit' />
            </View>
            <Text>查看更多好物</Text>
          </View>
        </View>
      </ScrollView>

    </View>
  )
}

export default Index
