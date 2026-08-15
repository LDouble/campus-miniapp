import { useEffect, useRef, useState } from 'react'
import Taro, {
  useDidHide,
  useDidShow,
  useLoad,
  usePullDownRefresh,
} from '@tarojs/taro'
import { Image, ScrollView, Text, View } from '@tarojs/components'
import type {
  CampusCirclePostView,
  CampusCircleSectionView,
} from '../../api/types'
import CustomNavbar, { getNavbarMetrics } from '../../components/custom-navbar'
import CommunityFeedPanel from '../../features/community/feed-panel'
import { consumeCommunityFeedPin } from '../../features/community/feed-pin'
import {
  isLifeHubSection,
  lifeBusinessThemeList,
  lifeBusinessThemes,
  type LifeHubSection,
} from '../../features/life-services/business-theme'
import { lifeServicesRepository } from '../../features/life-services/repository'
import {
  isLifeHubSectionRefreshRequired,
  markLifeHubSectionDirty,
} from '../../features/life-services/refresh-policy'
import LifeServiceListPanel, {
  type LifeServiceSection,
} from '../../features/life-services/list-panel'
import {
  consumeMarketplaceSearchPrefill,
  type MarketplaceSearchPrefill,
} from '../../features/life-services/marketplace-prefill'
import {
  getMiniappRuntimeConfig,
  loadMiniappRuntimeConfig,
  resolveMiniappModule,
  type MiniappModuleKey,
} from '../../features/runtime-config'
import { showActionSheetSelection } from '../../utils/action-sheet'
import { useCampusShare } from '../../features/share'
import { useCollapsingHeader } from '../../hooks/use-collapsing-header'
import {
  setCustomTabBarHidden,
  setCustomTabBarPublishSection,
  syncCustomTabBar,
} from '../../utils/tabbar'
import './index.scss'

const icons = {
  search: require('../../assets/icons/search.svg'),
}

const LIFE_HUB_SECTION_KEY = 'campus.lifeHub.section.v1'
const COMMUNITY_SECTIONS_FRESH_MS = 5 * 60_000
const lifeSectionModules: Record<LifeHubSection, MiniappModuleKey> = {
  community: 'community',
  errands: 'errand',
  market: 'marketplace',
  carpool: 'carpool',
}

export default function CommunityPage() {
  const [runtimeConfig, setRuntimeConfig] = useState(getMiniappRuntimeConfig)
  const [activeSection, setActiveSection] = useState<LifeHubSection>('community')
  const [communityRoots, setCommunityRoots] = useState<CampusCircleSectionView[]>([])
  const [communitySectionsReady, setCommunitySectionsReady] = useState(false)
  const [communitySectionsError, setCommunitySectionsError] = useState('')
  const [activeCommunitySectionId, setActiveCommunitySectionId] = useState(0)
  const [pinnedCommunityPost, setPinnedCommunityPost] = useState<
    CampusCirclePostView | null
  >(null)
  const [refreshSignal, setRefreshSignal] = useState(0)
  const [searchFocusSignal, setSearchFocusSignal] = useState(0)
  const [marketplaceSearchPrefill, setMarketplaceSearchPrefill] = useState<
    MarketplaceSearchPrefill | null
  >(null)
  const hasShown = useRef(false)
  const communitySectionsFreshAt = useRef(0)
  const communitySectionsRequest = useRef(0)
  const navbarMetrics = getNavbarMetrics()
  const navbarHeight = navbarMetrics.statusBarHeight + navbarMetrics.navigationBarHeight
  const headerCollapsed = useCollapsingHeader({
    triggerSelector: '.community-page__eyebrow',
    threshold: 52,
    releaseGap: 16,
  })

  useLoad((options) => {
    if (!isLifeHubSection(options.section)) return
    setActiveSection(options.section)
    Taro.setStorageSync(LIFE_HUB_SECTION_KEY, options.section)
  })

  const visibleLifeSections = lifeBusinessThemeList.filter((section) => (
    resolveMiniappModule(runtimeConfig, lifeSectionModules[section.key]).state !== 'hidden'
  ))
  const fallbackSection = visibleLifeSections[0]?.key || 'community'
  const displayedSection = visibleLifeSections.some(
    (section) => section.key === activeSection,
  ) ? activeSection : fallbackSection
  const hasVisibleLifeSection = visibleLifeSections.length > 0
  const displayedModule = resolveMiniappModule(
    runtimeConfig,
    lifeSectionModules[displayedSection],
  )
  const canUseDisplayedSection = hasVisibleLifeSection
    && displayedModule.state === 'enabled'
  const baseCopy = lifeBusinessThemes[displayedSection]
  const allCommunitySections = communityRoots.flatMap((root) => [
    root,
    ...(root.children || []).filter((item) => item.status === 'active'),
  ])
  const activeCommunitySection = allCommunitySections.find(
    (item) => item.id === activeCommunitySectionId,
  ) || communityRoots[0] || null
  const activeCommunityRoot = activeCommunitySection?.parent_id === null
    ? activeCommunitySection
    : communityRoots.find(
      (root) => root.id === activeCommunitySection?.parent_id,
    ) || communityRoots[0] || null
  const activeCommunityChildren = (activeCommunityRoot?.children || []).filter(
    (item) => item.status === 'active',
  )
  const pageCopy = displayedSection === 'community' && activeCommunityRoot
    ? {
      ...baseCopy,
      title: activeCommunityRoot.name,
      subtitle: activeCommunityRoot.description || baseCopy.subtitle,
    }
    : baseCopy

  useEffect(() => {
    setCustomTabBarPublishSection(displayedSection)
  }, [displayedSection])

  const loadCommunitySections = async (force = false) => {
    if (
      !force
      && communitySectionsReady
      && Date.now() - communitySectionsFreshAt.current < COMMUNITY_SECTIONS_FRESH_MS
    ) return
    const requestId = ++communitySectionsRequest.current
    setCommunitySectionsError('')
    try {
      const result = await lifeServicesRepository.listCampusCircleSections()
      if (requestId !== communitySectionsRequest.current) return
      const roots = result.items.filter(
        (item) => item.parent_id === null && item.status === 'active',
      )
      setCommunityRoots(roots)
      setActiveCommunitySectionId((current) => {
        const available = roots.flatMap((root) => [
          root,
          ...(root.children || []).filter((item) => item.status === 'active'),
        ])
        if (available.some((item) => item.id === current)) return current
        return roots[0]?.id || 0
      })
      communitySectionsFreshAt.current = Date.now()
    } catch {
      if (requestId !== communitySectionsRequest.current) return
      setCommunityRoots([])
      setActiveCommunitySectionId(0)
      setCommunitySectionsError('社区板块加载失败，请稍后重试')
    } finally {
      if (requestId === communitySectionsRequest.current) {
        setCommunitySectionsReady(true)
      }
    }
  }

  const selectSection = (section: LifeHubSection) => {
    const module = resolveMiniappModule(runtimeConfig, lifeSectionModules[section])
    if (module.state === 'maintenance') {
      void Taro.navigateTo({
        url: `/pages/feature-unavailable/index?module=${lifeSectionModules[section]}&message=${encodeURIComponent(
          module.message || '功能维护中，请稍后再试',
        )}`,
      })
      return
    }
    if (module.state === 'hidden') return
    setMarketplaceSearchPrefill(null)
    setActiveSection(section)
    Taro.setStorageSync(LIFE_HUB_SECTION_KEY, section)
  }

  const selectCommunityRoot = (root: CampusCircleSectionView) => {
    setActiveCommunitySectionId(root.id)
  }

  const chooseCommunitySection = async () => {
    if (!activeCommunityRoot || activeCommunityChildren.length === 0) return
    const options = [activeCommunityRoot, ...activeCommunityChildren]
    const tapIndex = await showActionSheetSelection(
      options.map((item, index) => index === 0 ? '全部' : item.name),
    )
    if (tapIndex === null) return
    const selected = options[tapIndex]
    if (selected) setActiveCommunitySectionId(selected.id)
  }

  const scrollSearchBelowNavigation = () => new Promise<void>((resolve) => {
    const query = Taro.createSelectorQuery()
    query.select('.community-content-anchor').boundingClientRect()
    query.select('.life-hub-navigation').boundingClientRect()
    query.selectViewport().scrollOffset()
    query.exec((results) => {
      const content = results[0] as { top?: number } | null
      const navigation = results[1] as { height?: number } | null
      const viewport = results[2] as { scrollTop?: number } | null
      const contentTop = Number(content?.top)
      const navigationHeight = Number(navigation?.height)

      if (!Number.isFinite(contentTop) || !Number.isFinite(navigationHeight)) {
        resolve()
        return
      }

      const currentScrollTop = Number(viewport?.scrollTop || 0)
      const visibleTop = navbarHeight + navigationHeight + 8
      void Taro.pageScrollTo({
        scrollTop: Math.max(24, currentScrollTop + contentTop - visibleTop),
        duration: 180,
      }).then(() => resolve()).catch(() => resolve())
    })
  })

  const focusSearch = async () => {
    await scrollSearchBelowNavigation()
    setSearchFocusSignal((current) => current + 1)
  }

  useDidShow(() => {
    syncCustomTabBar('community')
    if (
      hasShown.current
      && isLifeHubSectionRefreshRequired(displayedSection)
    ) {
      setRefreshSignal((current) => current + 1)
    }
    hasShown.current = true
    void loadMiniappRuntimeConfig().then((config) => {
      setRuntimeConfig(config)
      const availableSections = lifeBusinessThemeList.filter((section) => (
        resolveMiniappModule(config, lifeSectionModules[section.key]).state !== 'hidden'
      ))
      const firstSection = availableSections.find((section) => (
        resolveMiniappModule(config, lifeSectionModules[section.key]).state === 'enabled'
      ))?.key || availableSections[0]?.key || 'community'
      setActiveSection((current) => (
        availableSections.some((section) => (
          section.key === current
          && resolveMiniappModule(
            config,
            lifeSectionModules[section.key],
          ).state === 'enabled'
        ))
          ? current
          : firstSection
      ))
      if (resolveMiniappModule(config, 'community').state === 'enabled') {
        void loadCommunitySections()
      } else {
        setCommunityRoots([])
        setCommunitySectionsReady(true)
      }
    })
    const feedPin = consumeCommunityFeedPin()
    setPinnedCommunityPost(feedPin)
    if (feedPin) {
      setMarketplaceSearchPrefill(null)
      if (resolveMiniappModule(runtimeConfig, 'community').state !== 'hidden') {
        setActiveSection('community')
      }
      setActiveCommunitySectionId(feedPin.section_id)
      void Taro.pageScrollTo({ scrollTop: 0, duration: 0 })
      return
    }
    const marketplacePrefill = consumeMarketplaceSearchPrefill()
    if (marketplacePrefill) {
      if (resolveMiniappModule(runtimeConfig, 'marketplace').state !== 'hidden') {
        setActiveSection('market')
        setMarketplaceSearchPrefill(marketplacePrefill)
      }
      return
    }
    const savedSection = Taro.getStorageSync<string>(LIFE_HUB_SECTION_KEY)
    if (savedSection && isLifeHubSection(savedSection)) {
      if (
        resolveMiniappModule(
          runtimeConfig,
          lifeSectionModules[savedSection],
        ).state !== 'hidden'
      ) {
        setActiveSection(savedSection)
      }
    }
  })

  useDidHide(() => {
    setCustomTabBarHidden(false)
  })

  usePullDownRefresh(() => {
    setPinnedCommunityPost(null)
    markLifeHubSectionDirty(displayedSection)
    setRefreshSignal((current) => current + 1)
    if (resolveMiniappModule(runtimeConfig, 'community').state === 'enabled') {
      void loadCommunitySections(true).finally(() => Taro.stopPullDownRefresh())
      return
    }
    Taro.stopPullDownRefresh()
  })

  useCampusShare((event) => {
    const target = event.target as {
      dataset?: Record<string, string | number>
    } | undefined
    const dataset = target?.dataset || {}
    const postId = Number(dataset.postId)
    const shareTitle = typeof dataset.shareTitle === 'string'
      ? dataset.shareTitle
      : '海大校园社区'
    const shareImage = typeof dataset.shareImage === 'string'
      ? dataset.shareImage
      : ''
    const result = {
      title: shareTitle,
      path: postId > 0 ? '/pages/community/detail' : '/pages/community/index',
      query: postId > 0
        ? { id: postId, mode: 'post' }
        : { section: displayedSection },
    }
    return shareImage ? { ...result, imageUrl: shareImage } : result
  })

  return (
    <View className={`community-page community-page--${displayedSection}`}>
      <CustomNavbar
        title='社区'
        immersive
        compactImmersive
        collapsed={headerCollapsed}
        actionIcon={icons.search}
        actionLabel={`搜索${pageCopy.title}`}
        actionVisible={headerCollapsed && canUseDisplayedSection}
        onAction={() => void focusSearch()}
      />

      <View
        className='community-page__intro'
        style={{ paddingRight: `${navbarMetrics.sideWidth + 8}px` }}
      >
        <View className='community-page__intro-copy'>
          <Text className='community-page__eyebrow'>社区</Text>
        </View>
        <View
          className='community-page__search-action'
          hoverClass='community-page__search-action--pressed'
          ariaRole='button'
          ariaLabel={`搜索${pageCopy.title}`}
          onClick={() => void focusSearch()}
        >
          <Image src={icons.search} mode='aspectFit' />
          <Text>{baseCopy.searchHint}</Text>
        </View>
      </View>

      <View
        className={`life-hub-navigation ${
          headerCollapsed ? 'life-hub-navigation--active' : ''
        }`}
        style={{ top: `${navbarHeight}px` }}
      >
        <ScrollView className='life-primary-tabs' scrollX enhanced showScrollbar={false}>
          <View className='life-primary-tabs__inner'>
            {visibleLifeSections.map((section) => (
              <View
                id={`life-section-${section.key}`}
                key={section.key}
                className={`life-primary-tabs__item life-primary-tabs__item--${section.key} ${
                  displayedSection === section.key
                    ? 'life-primary-tabs__item--active'
                    : ''
                }`}
                hoverClass='life-primary-tabs__item--pressed'
                ariaRole='button'
                ariaLabel={`切换到${section.label}`}
                onClick={() => selectSection(section.key)}
              >
                {section.label}
              </View>
            ))}
          </View>
        </ScrollView>

        {displayedSection === 'community' && communityRoots.length > 0 && (
          <>
            <ScrollView className='community-root-tabs' scrollX enhanced showScrollbar={false}>
              <View className='community-root-tabs__inner'>
                {communityRoots.map((root) => (
                  <View
                    id={`community-root-${root.id}`}
                    key={root.id}
                    className={
                      activeCommunityRoot?.id === root.id
                        ? 'community-root-tabs__item community-root-tabs__item--active'
                        : 'community-root-tabs__item'
                    }
                    hoverClass='community-root-tabs__item--pressed'
                    ariaRole='button'
                    ariaLabel={`筛选${root.name}`}
                    onClick={() => selectCommunityRoot(root)}
                  >
                    {root.name}
                  </View>
                ))}
              </View>
            </ScrollView>

          </>
        )}
      </View>

      <View className='community-content-anchor'>
        {!canUseDisplayedSection ? (
          <View className='community-module-state'>
            <View className='community-module-state__mark'>···</View>
            <Text className='community-module-state__title'>
              {hasVisibleLifeSection ? `${baseCopy.title}维护中` : '校园社区暂未开放'}
            </Text>
            <Text className='community-module-state__message'>
              {displayedModule.message || '功能正在调整，请稍后再来看看'}
            </Text>
          </View>
        ) : displayedSection === 'community' ? (
          <CommunityFeedPanel
            sectionRoots={communityRoots}
            activeSection={activeCommunitySection}
            sectionsReady={communitySectionsReady}
            sectionsError={communitySectionsError}
            onRetrySections={() => void loadCommunitySections()}
            pinnedPost={pinnedCommunityPost}
            refreshSignal={refreshSignal}
            searchFocusSignal={searchFocusSignal}
            filterLabel={
              activeCommunitySection?.parent_id === null
                ? '全部'
                : activeCommunitySection?.name || '全部'
            }
            canFilter={activeCommunityChildren.length > 0}
            onOpenFilter={() => void chooseCommunitySection()}
          />
        ) : (
          <LifeServiceListPanel
            key={displayedSection}
            section={displayedSection as LifeServiceSection}
            refreshSignal={refreshSignal}
            searchFocusSignal={searchFocusSignal}
            marketplaceSearchPrefill={marketplaceSearchPrefill}
            onMarketplaceSearchPrefillConsumed={() => {
              setMarketplaceSearchPrefill(null)
            }}
          />
        )}
      </View>

    </View>
  )
}
