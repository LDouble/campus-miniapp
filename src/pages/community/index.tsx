import { useState } from 'react'
import Taro, {
  useDidHide,
  useDidShow,
  usePullDownRefresh,
  useShareAppMessage,
} from '@tarojs/taro'
import { ScrollView, Text, View } from '@tarojs/components'
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
import LifeServiceListPanel, {
  type LifeServiceSection,
} from '../../features/life-services/list-panel'
import {
  consumeMarketplaceSearchPrefill,
  type MarketplaceSearchPrefill,
} from '../../features/life-services/marketplace-prefill'
import { useCollapsingHeader } from '../../hooks/use-collapsing-header'
import { setCustomTabBarHidden, syncCustomTabBar } from '../../utils/tabbar'
import './index.scss'

const icons = {
  search: require('../../assets/icons/search.svg'),
}

const LIFE_HUB_SECTION_KEY = 'campus.lifeHub.section.v1'

export default function CommunityPage() {
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
  const navbarMetrics = getNavbarMetrics()
  const navbarHeight = navbarMetrics.statusBarHeight + navbarMetrics.navigationBarHeight
  const headerCollapsed = useCollapsingHeader({
    triggerSelector: '.community-page__eyebrow',
    threshold: 52,
    releaseGap: 16,
  })

  const baseCopy = lifeBusinessThemes[activeSection]
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
  const pageCopy = activeSection === 'community' && activeCommunityRoot
    ? {
      ...baseCopy,
      title: activeCommunityRoot.name,
      subtitle: activeCommunityRoot.description || baseCopy.subtitle,
    }
    : baseCopy

  const loadCommunitySections = async () => {
    setCommunitySectionsError('')
    try {
      const result = await lifeServicesRepository.listCampusCircleSections()
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
    } catch {
      setCommunityRoots([])
      setActiveCommunitySectionId(0)
      setCommunitySectionsError('社区板块加载失败，请稍后重试')
    } finally {
      setCommunitySectionsReady(true)
    }
  }

  const selectSection = (section: LifeHubSection) => {
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
    const result = await Taro.showActionSheet({
      itemList: options.map((item, index) => index === 0 ? '全部' : item.name),
    })
    const selected = options[result.tapIndex]
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
        scrollTop: Math.max(0, currentScrollTop + contentTop - visibleTop),
        duration: 180,
      }).then(() => resolve()).catch(() => resolve())
    })
  })

  const focusSearch = async () => {
    await scrollSearchBelowNavigation()
    setSearchFocusSignal((current) => current + 1)
  }

  const openPublish = () => {
    if (activeSection === 'community') {
      if (!activeCommunitySection) {
        Taro.showToast({ title: '暂无可发布的社区板块', icon: 'none' })
        return
      }
      Taro.navigateTo({
        url: `/pages/publish/index?section=community&community_section_id=${activeCommunitySection.id}`,
      })
      return
    }
    Taro.navigateTo({ url: `/pages/publish/index?section=${activeSection}` })
  }

  useDidShow(() => {
    syncCustomTabBar(1)
    setRefreshSignal((current) => current + 1)
    void loadCommunitySections()
    const feedPin = consumeCommunityFeedPin()
    setPinnedCommunityPost(feedPin)
    if (feedPin) {
      setMarketplaceSearchPrefill(null)
      setActiveSection('community')
      setActiveCommunitySectionId(feedPin.section_id)
      void Taro.pageScrollTo({ scrollTop: 0, duration: 0 })
      return
    }
    const marketplacePrefill = consumeMarketplaceSearchPrefill()
    if (marketplacePrefill) {
      setActiveSection('market')
      setMarketplaceSearchPrefill(marketplacePrefill)
      return
    }
    const savedSection = Taro.getStorageSync<string>(LIFE_HUB_SECTION_KEY)
    if (savedSection && isLifeHubSection(savedSection)) {
      setActiveSection(savedSection)
    }
  })

  useDidHide(() => {
    setCustomTabBarHidden(false)
  })

  usePullDownRefresh(() => {
    setPinnedCommunityPost(null)
    setRefreshSignal((current) => current + 1)
    void loadCommunitySections().finally(() => Taro.stopPullDownRefresh())
  })

  useShareAppMessage((event) => {
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
      path: postId > 0
        ? `/pages/community/detail?id=${postId}&mode=post`
        : '/pages/community/index',
    }
    return shareImage ? { ...result, imageUrl: shareImage } : result
  })

  return (
    <View className={`community-page community-page--${activeSection}`}>
      <CustomNavbar
        title={pageCopy.title}
        immersive
        compactImmersive
        collapsed={headerCollapsed}
        actionIcon={icons.search}
        actionLabel={`搜索${pageCopy.title}`}
        actionVisible={headerCollapsed}
        onAction={() => void focusSearch()}
      />

      <View className='community-page__intro'>
        <View className='community-page__intro-copy'>
          <Text className='community-page__eyebrow'>{pageCopy.title}</Text>
          <Text className='community-page__subtitle'>{pageCopy.subtitle}</Text>
        </View>
      </View>

      <View
        className={`life-hub-navigation ${
          headerCollapsed ? 'life-hub-navigation--active' : ''
        }`}
        style={{ top: `${navbarHeight}px` }}
      >
        <View className='life-primary-tabs'>
          {lifeBusinessThemeList.map((section) => (
            <View
              id={`life-section-${section.key}`}
              key={section.key}
              className={`life-primary-tabs__item life-primary-tabs__item--${section.key} ${
                activeSection === section.key
                  ? 'life-primary-tabs__item--active'
                  : ''
              }`}
              hoverClass='life-primary-tabs__item--pressed'
              onClick={() => selectSection(section.key)}
            >
              {section.label}
            </View>
          ))}
        </View>

        {activeSection === 'community' && communityRoots.length > 0 && (
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
        {activeSection === 'community' ? (
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
            key={activeSection}
            section={activeSection as LifeServiceSection}
            refreshSignal={refreshSignal}
            searchFocusSignal={searchFocusSignal}
            marketplaceSearchPrefill={marketplaceSearchPrefill}
            onMarketplaceSearchPrefillConsumed={() => {
              setMarketplaceSearchPrefill(null)
            }}
          />
        )}
      </View>

      <View
        id={`life-publish-${activeSection}`}
        className={`life-publish-fab community-publish-fab life-publish-fab--${activeSection} ${
          headerCollapsed ? 'life-publish-fab--compact' : ''
        }`}
        hoverClass='life-publish-fab--pressed'
        onClick={openPublish}
      >
        <Text>＋</Text>
        <Text>{baseCopy.publishLabel}</Text>
      </View>
    </View>
  )
}
