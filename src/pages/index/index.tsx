import { useEffect, useMemo, useState } from 'react'
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
import type { MarketplaceListingView, Notice } from '../../api/types'
import CustomNavbar from '../../components/custom-navbar'
import { KeyboardSafeInput } from '../../components/keyboard-safe-input'
import {
  avatarText,
  currentDateParts,
  noticeCategory,
  noticeTime,
  resolveNextCourse,
} from '../../features/home/data'
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
  RuntimeBanner,
  saveSelectedCampus,
} from '../../features/runtime-config'
import { useCollapsingHeader } from '../../hooks/use-collapsing-header'
import { academicRepository } from '../academic/repository'
import { academicStorage } from '../academic/storage'
import { getAcademicCalendarLabel } from '../academic/utils'
import { syncCustomTabBar } from '../../utils/tabbar'
import './index.scss'

const icons = {
  search: require('../../assets/icons/search.svg'),
  scan: require('../../assets/icons/scan.svg'),
  bell: require('../../assets/icons/bell.svg'),
  academic: require('../../assets/icons/academic.svg'),
  community: require('../../assets/icons/community.svg'),
  market: require('../../assets/icons/market.svg'),
  errands: require('../../assets/icons/errands.svg'),
  lost: require('../../assets/icons/lost.svg'),
  calendar: require('../../assets/icons/calendar.svg'),
  grade: require('../../assets/icons/grade.svg'),
  exam: require('../../assets/icons/exam.svg'),
  study: require('../../assets/icons/study.svg'),
  result: require('../../assets/icons/result.svg'),
  passRate: require('../../assets/icons/pass-rate.svg'),
  materials: require('../../assets/icons/materials.svg'),
  shuttle: require('../../assets/icons/shuttle.svg'),
  location: require('../../assets/icons/location.svg'),
  arrow: require('../../assets/icons/arrow.svg'),
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
  { key: 'study', name: '自习室', icon: icons.study, tone: 'purple', route: '/pages/campus-service/index?type=study' },
  { key: 'result', name: '选课结果', icon: icons.result, tone: 'orange', route: '/pages/academic/selection/index' },
  { key: 'pass-rate', name: '通过率', icon: icons.passRate, tone: 'cyan', route: '/pages/campus-service/index?type=pass-rate' },
  { key: 'materials', name: '资料', icon: icons.materials, tone: 'green', route: '/pages/materials/index' },
  { key: 'calendar', name: '校历', icon: icons.calendar, tone: 'pink', route: '/pages/campus-service/index?type=calendar' },
  { key: 'shuttle', name: '校车', icon: icons.shuttle, tone: 'blue', route: '/pages/campus-service/index?type=shuttle' },
  { key: 'community', name: '社区', icon: icons.community, tone: 'purple', tab: '/pages/community/index' },
  { key: 'market', name: '二手', icon: icons.market, tone: 'orange', module: 'market' },
  { key: 'errands', name: '跑腿', icon: icons.errands, tone: 'blue', module: 'errands' },
  { key: 'carpool', name: '拼车', icon: icons.shuttle, tone: 'cyan', module: 'carpool' },
  { key: 'lost', name: '失物招领', icon: icons.lost, tone: 'pink', route: '/pages/campus-service/index?type=lost' },
  { key: 'library', name: '图书馆', icon: icons.study, tone: 'green', route: '/pages/campus-service/index?type=library' },
  { key: 'classroom', name: '空教室', icon: icons.academic, tone: 'mint', route: '/pages/campus-service/index?type=classroom' },
  { key: 'campus-card', name: '校园卡', icon: icons.result, tone: 'sand', route: '/pages/campus-service/index?type=campus-card' },
  { key: 'repair', name: '校园报修', icon: icons.materials, tone: 'purple', route: '/pages/campus-service/index?type=repair' },
]

const homeServiceKeys = new Set([
  'schedule',
  'grades',
  'exams',
  'classroom',
  'shuttle',
  'campus-card',
  'community',
  'market',
])
const homeServices = quickServices.filter((item) => homeServiceKeys.has(item.key))
const serviceFeatureKeys: Record<string, string> = {
  classroom: 'classroom',
  shuttle: 'shuttle',
  'campus-card': 'campus_card',
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

const loadCachedNextCourse = (
  config: MiniappRuntimeConfig,
  campusName: string,
) => {
  const userId = getActiveAcademicUserId()
  return resolveNextCourse(
    academicStorage.getScheduleCache(userId),
    config,
    campusName,
  )
}

const loadCachedAcademicLabel = () => {
  const userId = getActiveAcademicUserId()
  const cache = academicStorage.getScheduleCache(userId)
  return getAcademicCalendarLabel(cache ? cache.periods : [])
}

const loadLatestAcademicLabel = async (userIdPromise: Promise<number>) => {
  const periodsPromise = settle(academicRepository.getPeriods())
  const userId = await userIdPromise
  const cache = academicStorage.getScheduleCache(userId)
  const periodsResult = await periodsPromise

  if (!periodsResult.ok || !periodsResult.value.length) {
    return getAcademicCalendarLabel(cache ? cache.periods : [])
  }
  const currentCache = academicStorage.getScheduleCache(userId)
  academicStorage.setScheduleCache(
    userId,
    periodsResult.value,
    currentCache ? currentCache.coursesByPeriod : {},
  )
  return getAcademicCalendarLabel(periodsResult.value)
}

const noticePriority = (notice: Notice) => {
  if (notice.priority === 'urgent') return 0
  if (notice.priority === 'important') return 1
  return 2
}

const prioritizeNotices = (items: Notice[]) => (
  [...items]
    .sort((left, right) => {
      const priority = noticePriority(left) - noticePriority(right)
      if (priority !== 0) return priority
      const leftTime = new Date(left.published_at || left.publish_at || left.created_at).getTime()
      const rightTime = new Date(right.published_at || right.publish_at || right.created_at).getTime()
      return rightTime - leftTime
    })
    .slice(0, 4)
)

function Index() {
  const [runtimeConfig, setRuntimeConfig] = useState(getMiniappRuntimeConfig)
  const [campusName, setCampusName] = useState(() => (
    getSelectedCampus(getMiniappRuntimeConfig())
  ))
  const [searchValue, setSearchValue] = useState('')
  const [username, setUsername] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const [news, setNews] = useState<Notice[]>([])
  const [marketItems, setMarketItems] = useState<MarketplaceListingView[]>([])
  const [newsLoading, setNewsLoading] = useState(true)
  const [marketLoading, setMarketLoading] = useState(true)
  const [newsError, setNewsError] = useState(false)
  const [marketError, setMarketError] = useState(false)
  const [nextCourse, setNextCourse] = useState(() => (
    loadCachedNextCourse(runtimeConfig, campusName)
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

  const loadHome = async () => {
    const accountPromise = settle(getCurrentUser())
    const academicUserIdPromise = accountPromise.then((account) => (
      account.ok ? account.value.user.id : getActiveAcademicUserId()
    ))
    const academicLabelPromise = loadLatestAcademicLabel(academicUserIdPromise)
    const runtimeConfigPromise = loadMiniappRuntimeConfig()
    const [
      account,
      notices,
      unread,
      marketplace,
      latestAcademicLabel,
      latestRuntimeConfig,
    ] = await Promise.all([
      accountPromise,
      settle(noticesRepository.list({ page: 1, pageSize: 8 })),
      settle(noticesRepository.unreadCount()),
      settle(lifeServicesRepository.listMarketplace({ page: 1, pageSize: 2 })),
      academicLabelPromise,
      runtimeConfigPromise,
    ])

    const selectedCampus = getSelectedCampus(latestRuntimeConfig)
    setRuntimeConfig(latestRuntimeConfig)
    setCampusName(selectedCampus)
    setBannerIndex(0)
    setNextCourse(loadCachedNextCourse(latestRuntimeConfig, selectedCampus))
    if (account.ok) setUsername(account.value.user.username)
    setAcademicCalendarLabel(latestAcademicLabel)
    if (notices.ok) {
      setNews(prioritizeNotices(notices.value.items))
      setNewsError(false)
    } else {
      setNewsError(true)
    }
    if (unread.ok) setUnreadCount(Number(unread.value.count) || 0)
    if (marketplace.ok) {
      setMarketItems(marketplace.value.items)
      setMarketError(false)
    } else {
      setMarketError(true)
    }
    setNewsLoading(false)
    setMarketLoading(false)
    Taro.stopPullDownRefresh()
  }

  useEffect(() => {
    void loadHome()
  }, [])

  useDidShow(() => {
    syncCustomTabBar(0)
    setNextCourse(loadCachedNextCourse(runtimeConfig, campusName))
    setAcademicCalendarLabel(loadCachedAcademicLabel())
  })

  usePullDownRefresh(() => {
    setNextCourse(loadCachedNextCourse(runtimeConfig, campusName))
    setAcademicCalendarLabel(loadCachedAcademicLabel())
    void loadHome()
  })

  const openLifeHub = (section: LifeHubSection) => {
    Taro.setStorageSync(LIFE_HUB_SECTION_KEY, section)
    Taro.switchTab({ url: '/pages/community/index' })
  }

  const openModule = (type: string) => {
    if (['community', 'errands', 'market', 'carpool'].includes(type)) {
      openLifeHub(type as LifeHubSection)
      return
    }
    Taro.showToast({ title: '服务入口已更新', icon: 'none' })
  }

  const openAcademic = (route: string) => {
    Taro.navigateTo({ url: route })
  }

  const openQuickService = (item: typeof quickServices[number]) => {
    if ('tab' in item && item.tab) {
      openLifeHub('community')
      return
    }
    if ('route' in item && item.route) {
      openAcademic(item.route)
      return
    }
    if ('module' in item && item.module) {
      if (['market', 'errands', 'carpool'].includes(item.module)) {
        openLifeHub(item.module as LifeHubSection)
        return
      }
      Taro.showToast({ title: `${item.name}入口配置异常`, icon: 'none' })
    }
  }

  const openAllServices = () => {
    Taro.navigateTo({ url: '/pages/services/index' })
  }

  const openSchedule = () => {
    Taro.navigateTo({ url: '/pages/academic/schedule/index' })
  }

  const showTip = (title: string) => Taro.showToast({ title, icon: 'none' })

  const searchResults = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase()
    if (!keyword) return []
    return quickServices.filter((item) => item.name.toLowerCase().includes(keyword)).slice(0, 6)
  }, [searchValue])

  const handleSearch = () => {
    const keyword = searchValue.trim()
    if (!keyword) return showTip('输入关键词发现校园服务')
    if (searchResults[0]) {
      openQuickService(searchResults[0])
      setSearchValue('')
      return
    }
    openLifeHub('community')
  }

  const chooseCampus = async () => {
    const campuses = enabledCampuses(runtimeConfig)
    const result = await Taro.showActionSheet({ itemList: campuses })
    if (typeof result.tapIndex !== 'number') return
    const selectedCampus = campuses[result.tapIndex]
    setCampusName(selectedCampus)
    setBannerIndex(0)
    saveSelectedCampus(selectedCampus)
    setNextCourse(loadCachedNextCourse(runtimeConfig, selectedCampus))
  }

  const openNewsDetail = (item: Notice) => {
    void noticesRepository.read(item.id)
      .then(() => noticesRepository.unreadCount())
      .then((unread) => setUnreadCount(Number(unread.count) || 0))
      .catch(() => undefined)
    Taro.switchTab({ url: '/pages/messages/index' })
  }

  const today = currentDateParts()
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
    return !featureKey || !campusConfig || campusConfig.features[featureKey] !== false
  })
  const visibleNews = news.slice(0, 3)

  const openRuntimeBanner = (banner: RuntimeBanner) => {
    if (banner.action.type === 'miniapp_path' && banner.action.value) {
      Taro.navigateTo({ url: banner.action.value })
      return
    }
    if (banner.action.type === 'webview') {
      Taro.showToast({ title: '外部页面暂未开放', icon: 'none' })
    }
  }

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
          <View className='icon-button' onClick={() => Taro.scanCode({ onlyFromCamera: false }).catch(() => undefined)}>
            <Image src={icons.scan} mode='aspectFit' />
          </View>
          <View className='icon-button' onClick={() => Taro.switchTab({ url: '/pages/messages/index' })}>
            <Image src={icons.bell} mode='aspectFit' />
            {unreadCount > 0 && <View className='icon-button__dot' />}
          </View>
        </View>
      </View>

      <View className='campus__search'>
        <Image src={icons.search} mode='aspectFit' />
        <KeyboardSafeInput
          value={searchValue}
          onInput={(event) => setSearchValue(event.detail.value)}
          onConfirm={handleSearch}
          confirmType='search'
          placeholder='搜课表、闲置、校园活动…'
          placeholderClass='campus__search-placeholder'
        />
        <View className='campus__search-action' onClick={handleSearch}>搜索</View>
      </View>
      {!!searchValue.trim() && <View className='campus-search-results'>
        {searchResults.length ? searchResults.map((item) => <View key={item.key} onClick={() => { openQuickService(item); setSearchValue('') }}><Image src={item.icon} mode='aspectFit' /><Text>服务 · {item.name}</Text><Text>›</Text></View>) : <View onClick={() => openLifeHub('community')}><Image src={icons.search} mode='aspectFit' /><Text>去社区搜索“{searchValue.trim()}”</Text><Text>›</Text></View>}
      </View>}

      <View className='section-heading section-heading--today'>
        <View>
          <Text className='section-heading__title'>今天</Text>
          <Text className='section-heading__sub'>先看接下来要做的事</Text>
        </View>
        <Text className='section-heading__count'>{campusName}</Text>
      </View>

      <View className='schedule-card' onClick={openSchedule}>
        <View className='schedule-card__date'>
          <Text className='schedule-card__month'>{nextCourse ? nextCourse.month : today.month}</Text>
          <Text className='schedule-card__day'>{nextCourse ? nextCourse.day : today.day}</Text>
        </View>
        <View className='schedule-card__line' />
        <View className='schedule-card__main'>
          <View className='schedule-card__label'>
            <View className='schedule-card__status' />
            <Text>{nextCourse ? `下一节课 · ${nextCourse.startTime}` : '本学期课表'}</Text>
          </View>
          <Text className='schedule-card__course'>
            {nextCourse ? nextCourse.course.name : '暂无后续课程'}
          </Text>
          <View className='schedule-card__meta'>
            <Image src={icons.location} mode='aspectFit' />
            <Text>{nextCourse ? nextCourse.course.location || '地点待定' : '进入课表查看或刷新'}</Text>
            {nextCourse && nextCourse.course.teacher && <Text>·</Text>}
            {nextCourse && nextCourse.course.teacher && <Text>{nextCourse.course.teacher}</Text>}
          </View>
        </View>
        {nextCourse && <View className='schedule-card__badge'>{nextCourse.badge}</View>}
      </View>

      <View className='section-heading'>
        <View>
          <Text className='section-heading__title'>常用功能</Text>
          <Text className='section-heading__sub'>把每天会用的放在前面</Text>
        </View>
        <View className='section-heading__more section-heading__more--services' onClick={openAllServices}>
          <Text>全部服务</Text>
          <Image src={icons.arrow} mode='aspectFit' />
        </View>
      </View>

      <View className='service-panel'>
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
          <View className='hero-card__action'>
            <Text>{runtimeBanner ? '查看详情' : '发现校园新鲜事'}</Text>
            <Image src={icons.arrow} mode='aspectFit' />
          </View>
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
          <Text className='section-heading__sub'>重要消息，不再错过</Text>
        </View>
        <View className='section-heading__more' onClick={() => Taro.switchTab({ url: '/pages/messages/index' })}>
          <Text>更多</Text>
          <Image src={icons.arrow} mode='aspectFit' />
        </View>
      </View>

      <View className='news-card'>
        {newsLoading && <View className='home-section-state'>正在加载校园消息</View>}
        {!newsLoading && newsError && (
          <View className='home-section-state home-section-state--error' onClick={() => void loadHome()}>
            消息加载失败，点击重试
          </View>
        )}
        {!newsLoading && !newsError && visibleNews.length === 0 && (
          <View className='home-section-state'>暂时没有校园消息</View>
        )}
        {!newsLoading && !newsError && visibleNews.map((item, index) => (
          <View
            key={item.id}
            className={`news-card__item ${index !== visibleNews.length - 1 ? 'news-card__item--border' : ''}`}
            onClick={() => openNewsDetail(item)}
          >
            <View className={`news-card__tag news-card__tag--${item.priority}`}>
              {item.priority === 'urgent' ? '紧急' : noticeCategory(item)}
            </View>
            <View className='news-card__content'>
              <Text className='news-card__title'>{item.title}</Text>
              <Text className='news-card__time'>{noticeTime(item)}</Text>
            </View>
            <Image className='news-card__arrow' src={icons.arrow} mode='aspectFit' />
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
