import { useMemo, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Image, Input, ScrollView, Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import { useCollapsingHeader } from '../../hooks/use-collapsing-header'
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

const serviceColumnCount = Math.ceil(quickServices.length / 3)
const serviceColumns = Array.from({ length: serviceColumnCount }, (_, columnIndex) => (
  [0, 1, 2]
    .map((rowIndex) => quickServices[columnIndex + rowIndex * serviceColumnCount])
    .filter(Boolean)
))

const news = [
  { tag: '教务', title: '关于 2025-2026 学年第二学期选课的通知', time: '10分钟前' },
  { tag: '活动', title: '春日校园音乐节志愿者招募开始啦', time: '1小时前' },
  { tag: '生活', title: '崂山校区食堂本周新品菜单已上线', time: '昨天' },
]

const marketItems = [
  { name: '九成新拍立得 mini 11', price: '¥ 328', meta: '崂山校区 · 2小时前', type: 'camera' },
  { name: '高等数学同济第七版', price: '¥ 18', meta: '北海苑 · 5小时前', type: 'book' },
]

const LIFE_HUB_SECTION_KEY = 'campus.lifeHub.section.v1'
type LifeHubSection = 'community' | 'errands' | 'market' | 'carpool'

function Index() {
  const [searchValue, setSearchValue] = useState('')
  const [campusName, setCampusName] = useState('崂山校区')
  const headerCollapsed = useCollapsingHeader({
    triggerSelector: '.campus__eyebrow',
    threshold: 48,
    releaseGap: 16,
  })
  useDidShow(() => syncCustomTabBar(0))

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
    const campuses = ['崂山校区', '鱼山校区', '浮山校区']
    const result = await Taro.showActionSheet({ itemList: campuses })
    if (typeof result.tapIndex === 'number') setCampusName(campuses[result.tapIndex])
  }

  const openNewsDetail = (item: typeof news[number]) => {
    Taro.navigateTo({ url: `/pages/community/detail?mode=post&section=${encodeURIComponent(item.tag)}&title=${encodeURIComponent(item.title)}&content=${encodeURIComponent('查看校园最新通知与活动安排，具体时间和要求请以学校官方发布为准。')}&meta=${encodeURIComponent(item.time)}&badge=${encodeURIComponent('校园资讯')}` })
  }

  const openMarketDetail = (item: typeof marketItems[number]) => {
    Taro.navigateTo({ url: `/pages/community/detail?mode=service&section=${encodeURIComponent('海大二手')}&title=${encodeURIComponent(item.name)}&content=${encodeURIComponent('校内同学发布的闲置物品，支持当面查看和沟通。')}&meta=${encodeURIComponent(item.meta)}&badge=${encodeURIComponent('校内面交')}&value=${encodeURIComponent(item.price)}` })
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
            <Text>海</Text>
            <View className='campus__online' />
          </View>
          <View className='campus__identity-copy'>
            <Text className='campus__eyebrow'>下午好，海大同学</Text>
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
            <View className='icon-button__dot' />
          </View>
        </View>
      </View>

      <View className='campus__search'>
        <Image src={icons.search} mode='aspectFit' />
        <Input
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
        {searchResults.length ? searchResults.map((item) => <View key={item.key} onClick={() => { openQuickService(item); setSearchValue('') }}><Image src={item.icon} mode='aspectFit' /><Text>{item.name}</Text><Text>›</Text></View>) : <View onClick={() => openLifeHub('community')}><Image src={icons.search} mode='aspectFit' /><Text>去社区搜索“{searchValue.trim()}”</Text><Text>›</Text></View>}
      </View>}

      <View className='hero-card'>
        <View className='hero-card__glow' />
        <View className='hero-card__content'>
          <View className='hero-card__pill'>
            <View className='hero-card__pulse' />
            <Text>今日校园</Text>
          </View>
          <Text className='hero-card__title'>海纳百川，取则行远</Text>
          <Text className='hero-card__subtitle'>一站式连接海大学习与生活</Text>
          <View className='hero-card__action' onClick={() => openModule('community')}>
            <Text>发现校园新鲜事</Text>
            <Image src={icons.arrow} mode='aspectFit' />
          </View>
        </View>
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
      </View>

      <View className='section-heading'>
        <View>
          <Text className='section-heading__title'>常用功能</Text>
          <Text className='section-heading__sub'>高频服务一键直达</Text>
        </View>
        <View className='section-heading__more section-heading__more--services' onClick={openAllServices}>
          <Text>全部服务</Text>
          <Image src={icons.arrow} mode='aspectFit' />
        </View>
      </View>

      <View className='service-panel'>
        <ScrollView
          className='service-panel__scroll'
          scrollX
          enhanced
          showScrollbar={false}
        >
          <View className='service-panel__columns'>
            {serviceColumns.map((column, columnIndex) => (
              <View key={columnIndex} className='service-panel__column'>
                {column.map((item) => (
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
            ))}
          </View>
        </ScrollView>
        <View className='service-panel__edge-hint'>
          <Image src={icons.arrow} mode='aspectFit' />
        </View>
      </View>

      <View className='schedule-card' onClick={openSchedule}>
        <View className='schedule-card__date'>
          <Text className='schedule-card__month'>MAR</Text>
          <Text className='schedule-card__day'>18</Text>
        </View>
        <View className='schedule-card__line' />
        <View className='schedule-card__main'>
          <View className='schedule-card__label'>
            <View className='schedule-card__status' />
            <Text>下一节课 · 14:00</Text>
          </View>
          <Text className='schedule-card__course'>用户体验设计基础</Text>
          <View className='schedule-card__meta'>
            <Image src={icons.location} mode='aspectFit' />
              <Text>行远楼 A305</Text>
            <Text>·</Text>
            <Text>王老师</Text>
          </View>
        </View>
        <View className='schedule-card__badge'>还有 25 分钟</View>
      </View>

      <View className='section-heading section-heading--compact'>
        <View>
          <Text className='section-heading__title'>校园新鲜事</Text>
          <Text className='section-heading__sub'>重要消息，不再错过</Text>
        </View>
        <View className='section-heading__more' onClick={() => openModule('community')}>
          <Text>更多</Text>
          <Image src={icons.arrow} mode='aspectFit' />
        </View>
      </View>

      <View className='news-card'>
        {news.map((item, index) => (
          <View
            key={item.title}
            className={`news-card__item ${index !== news.length - 1 ? 'news-card__item--border' : ''}`}
            onClick={() => openNewsDetail(item)}
          >
            <View className={`news-card__tag news-card__tag--${index}`}>{item.tag}</View>
            <View className='news-card__content'>
              <Text className='news-card__title'>{item.title}</Text>
              <Text className='news-card__time'>{item.time}</Text>
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
          {marketItems.map((item) => (
            <View key={item.name} className='market-card' onClick={() => openMarketDetail(item)}>
              <View className={`market-card__cover market-card__cover--${item.type}`}>
                <View className='market-card__shape' />
                <Text>{item.type === 'camera' ? 'SNAP' : 'CALCULUS'}</Text>
              </View>
              <Text className='market-card__name'>{item.name}</Text>
              <View className='market-card__bottom'>
                <Text className='market-card__price'>{item.price}</Text>
                <Text className='market-card__meta'>{item.meta}</Text>
              </View>
            </View>
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
