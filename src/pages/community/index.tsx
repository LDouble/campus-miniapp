import { useState } from 'react'
import Taro, {
  useDidHide,
  useDidShow,
  usePullDownRefresh,
} from '@tarojs/taro'
import { Image, ScrollView, Text, View } from '@tarojs/components'
import type { CampusCircleSectionView } from '../../api/types'
import CustomNavbar, { getNavbarMetrics } from '../../components/custom-navbar'
import CommunityFeedPanel from '../../features/community/feed-panel'
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
  const [refreshSignal, setRefreshSignal] = useState(0)
  const [searchFocusSignal, setSearchFocusSignal] = useState(0)
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
    setActiveSection(section)
    Taro.setStorageSync(LIFE_HUB_SECTION_KEY, section)
  }

  const selectCommunityRoot = (root: CampusCircleSectionView) => {
    setActiveCommunitySectionId(root.id)
  }

  const focusSearch = () => {
    setSearchFocusSignal((current) => current + 1)
    Taro.pageScrollTo({ selector: '.community-content-anchor', duration: 180 })
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
    const savedSection = Taro.getStorageSync<string>(LIFE_HUB_SECTION_KEY)
    if (savedSection && isLifeHubSection(savedSection)) {
      setActiveSection(savedSection)
    }
  })

  useDidHide(() => {
    setCustomTabBarHidden(false)
  })

  usePullDownRefresh(() => {
    setRefreshSignal((current) => current + 1)
    void loadCommunitySections().finally(() => Taro.stopPullDownRefresh())
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
        onAction={focusSearch}
      />

      <View className='community-page__intro'>
        <View className='community-page__intro-copy'>
          <Text className='community-page__eyebrow'>{pageCopy.title}</Text>
          <Text className='community-page__subtitle'>{pageCopy.subtitle}</Text>
        </View>
        <View
          className='community-page__search-action'
          hoverClass='community-page__search-action--pressed'
          ariaRole='button'
          ariaLabel={`搜索${pageCopy.title}`}
          onClick={focusSearch}
        >
          <Image src={icons.search} mode='aspectFit' />
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

            {activeCommunityRoot && activeCommunityChildren.length > 0 && (
              <ScrollView className='community-subtabs' scrollX enhanced showScrollbar={false}>
                <View className='community-subtabs__inner'>
                  <View
                    id={`community-section-${activeCommunityRoot.id}`}
                    className={
                      activeCommunitySection?.id === activeCommunityRoot.id
                        ? 'community-subtabs__item community-section-tab community-subtabs__item--active'
                        : 'community-subtabs__item community-section-tab'
                    }
                    hoverClass='community-subtabs__item--pressed'
                    onClick={() => setActiveCommunitySectionId(activeCommunityRoot.id)}
                  >
                    全部
                  </View>
                  {activeCommunityChildren.map((section) => (
                    <View
                      id={`community-section-${section.id}`}
                      key={section.id}
                      className={
                        activeCommunitySection?.id === section.id
                          ? 'community-subtabs__item community-section-tab community-subtabs__item--active'
                          : 'community-subtabs__item community-section-tab'
                      }
                      hoverClass='community-subtabs__item--pressed'
                      onClick={() => setActiveCommunitySectionId(section.id)}
                    >
                      {section.name}
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
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
            refreshSignal={refreshSignal}
            searchFocusSignal={searchFocusSignal}
          />
        ) : (
          <LifeServiceListPanel
            key={activeSection}
            section={activeSection as LifeServiceSection}
            refreshSignal={refreshSignal}
            searchFocusSignal={searchFocusSignal}
          />
        )}
      </View>

      <View
        id={`life-publish-${activeSection}`}
        className={`life-publish-fab community-publish-fab life-publish-fab--${activeSection}`}
        hoverClass='life-publish-fab--pressed'
        onClick={openPublish}
      >
        <Text>＋</Text>
        <Text>{baseCopy.publishLabel}</Text>
      </View>
    </View>
  )
}
