import Taro from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import { KeyboardSafeInput } from '../../components/keyboard-safe-input'
import './index.scss'

const icons = {
  search: require('../../assets/icons/search.svg'),
  calendar: require('../../assets/icons/calendar.svg'),
  grade: require('../../assets/icons/grade.svg'),
  exam: require('../../assets/icons/exam.svg'),
  study: require('../../assets/icons/study.svg'),
  result: require('../../assets/icons/result.svg'),
  passRate: require('../../assets/icons/pass-rate.svg'),
  materials: require('../../assets/icons/materials.svg'),
  shuttle: require('../../assets/icons/shuttle.svg'),
  community: require('../../assets/icons/community.svg'),
  market: require('../../assets/icons/market.svg'),
  errands: require('../../assets/icons/errands.svg'),
  lost: require('../../assets/icons/lost.svg'),
  academic: require('../../assets/icons/academic.svg'),
}

type ServiceItem = {
  key: string
  name: string
  icon: string
  route?: string
  tab?: string
  lifeSection?: 'community' | 'errands' | 'market' | 'carpool'
}

const LIFE_HUB_SECTION_KEY = 'campus.lifeHub.section.v1'

const groups: Array<{ title: string; subtitle: string; items: ServiceItem[] }> = [
  {
    title: '教务服务',
    subtitle: '课程与教学信息',
    items: [
      { key: 'schedule', name: '课程表', icon: icons.calendar, route: '/pages/academic/schedule/index' },
      { key: 'grades', name: '成绩查询', icon: icons.grade, route: '/pages/academic/grades/index' },
      { key: 'exams', name: '考试安排', icon: icons.exam, route: '/pages/academic/exams/index' },
      { key: 'result', name: '选课结果', icon: icons.result, route: '/pages/academic/selection/index' },
      { key: 'pass-rate', name: '课程通过率', icon: icons.passRate, route: '/pages/campus-service/index?type=pass-rate' },
      { key: 'calendar', name: '校历', icon: icons.calendar, route: '/pages/campus-service/index?type=calendar' },
    ],
  },
  {
    title: '学习服务',
    subtitle: '学习空间与资源',
    items: [
      { key: 'study', name: '自习室', icon: icons.study, route: '/pages/campus-service/index?type=study' },
      { key: 'classroom', name: '空教室', icon: icons.academic, route: '/pages/campus-service/index?type=classroom' },
      { key: 'materials', name: '学习资料', icon: icons.materials, route: '/pages/materials/index' },
      { key: 'library', name: '图书馆', icon: icons.study, route: '/pages/campus-service/index?type=library' },
    ],
  },
  {
    title: '校园生活',
    subtitle: '日常校园服务',
    items: [
      { key: 'shuttle', name: '校园校车', icon: icons.shuttle, route: '/pages/campus-service/index?type=shuttle' },
      { key: 'carpool', name: '校园拼车', icon: icons.shuttle, lifeSection: 'carpool' },
      { key: 'community', name: '校园社区', icon: icons.community, lifeSection: 'community' },
      { key: 'market', name: '校园二手', icon: icons.market, lifeSection: 'market' },
      { key: 'errands', name: '校园跑腿', icon: icons.errands, lifeSection: 'errands' },
      { key: 'lost', name: '失物招领', icon: icons.lost, route: '/pages/campus-service/index?type=lost' },
      { key: 'campus-card', name: '校园卡', icon: icons.result, route: '/pages/campus-service/index?type=campus-card' },
      { key: 'repair', name: '校园报修', icon: icons.materials, route: '/pages/campus-service/index?type=repair' },
    ],
  },
]

export default function Services() {
  const openService = (item: ServiceItem) => {
    if (item.lifeSection) {
      Taro.setStorageSync(LIFE_HUB_SECTION_KEY, item.lifeSection)
      Taro.switchTab({ url: '/pages/community/index' })
      return
    }
    if (item.tab) {
      Taro.switchTab({ url: item.tab })
      return
    }
    if (item.route) {
      Taro.navigateTo({ url: item.route })
      return
    }
    Taro.showToast({ title: `${item.name}入口配置异常`, icon: 'none' })
  }

  return (
    <View className='services-page'>
      <CustomNavbar title='全部服务' subtitle='中国海洋大学' showBack />
      <View className='services-page__content'>
        <View className='services-search'>
          <Image src={icons.search} mode='aspectFit' />
          <KeyboardSafeInput placeholder='搜索校园服务' placeholderClass='services-search__placeholder' />
        </View>

        {groups.map((group) => (
          <View key={group.title} className='services-group'>
            <View className='services-group__head'>
              <View>
                <Text className='services-group__title'>{group.title}</Text>
                <Text className='services-group__subtitle'>{group.subtitle}</Text>
              </View>
              <Text className='services-group__count'>{group.items.length} 项</Text>
            </View>
            <View className='services-group__grid'>
              {group.items.map((item) => (
                <View
                  key={item.key}
                  className='services-group__item'
                  hoverClass='services-group__item--pressed'
                  onClick={() => openService(item)}
                >
                  <View className='services-group__icon'>
                    <Image src={item.icon} mode='aspectFit' />
                  </View>
                  <Text>{item.name}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}
