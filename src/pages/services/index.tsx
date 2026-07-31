import Taro, { useDidShow } from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import { useState } from 'react'
import CustomNavbar from '../../components/custom-navbar'
import {
  getMiniappRuntimeConfig,
  loadMiniappRuntimeConfig,
  openMiniappModule,
  resolveMiniappModule,
  type MiniappModuleKey,
} from '../../features/runtime-config'
import './index.scss'

const icons = {
  calendar: require('../../assets/icons/calendar.svg'),
  grade: require('../../assets/icons/grade.svg'),
  exam: require('../../assets/icons/exam.svg'),
  result: require('../../assets/icons/result.svg'),
  passRate: require('../../assets/icons/pass-rate.svg'),
  materials: require('../../assets/icons/materials.svg'),
  shuttle: require('../../assets/icons/shuttle.svg'),
  community: require('../../assets/icons/community.svg'),
  market: require('../../assets/icons/market.svg'),
  errands: require('../../assets/icons/errands.svg'),
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
const serviceModules: Partial<Record<string, MiniappModuleKey>> = {
  schedule: 'academic_schedule',
  grades: 'academic_grades',
  exams: 'academic_exams',
  result: 'academic_selection',
  'pass-rate': 'academic_statistics',
  calendar: 'calendar',
  classroom: 'empty_classroom',
  materials: 'course_materials',
  shuttle: 'shuttle',
  carpool: 'carpool',
  community: 'community',
  market: 'marketplace',
  errands: 'errand',
}

const groups: Array<{ title: string; subtitle: string; items: ServiceItem[] }> = [
  {
    title: '教务服务',
    subtitle: '课程与教学信息',
    items: [
      { key: 'schedule', name: '课程表', icon: icons.calendar, route: '/pages/academic/schedule/index' },
      { key: 'grades', name: '成绩查询', icon: icons.grade, route: '/pages/academic/grades/index' },
      { key: 'exams', name: '考试安排', icon: icons.exam, route: '/pages/academic/exams/index' },
      { key: 'result', name: '选课结果', icon: icons.result, route: '/pages/academic/selection/index' },
      { key: 'pass-rate', name: '课程通过率', icon: icons.passRate, route: '/pages/academic/statistics/courses' },
      { key: 'calendar', name: '校历', icon: icons.calendar, route: '/pages/calendar/index' },
    ],
  },
  {
    title: '学习服务',
    subtitle: '学习空间与资源',
    items: [
      { key: 'classroom', name: '空教室', icon: icons.academic, route: '/pages/empty-classroom/index' },
      { key: 'materials', name: '学习资料', icon: icons.materials, route: '/pages/materials/index' },
    ],
  },
  {
    title: '校园生活',
    subtitle: '日常校园服务',
    items: [
      { key: 'shuttle', name: '校园校车', icon: icons.shuttle, route: '/pages/shuttle/index' },
      { key: 'carpool', name: '校园拼车', icon: icons.shuttle, lifeSection: 'carpool' },
      { key: 'community', name: '校园社区', icon: icons.community, lifeSection: 'community' },
      { key: 'market', name: '校园二手', icon: icons.market, lifeSection: 'market' },
      { key: 'errands', name: '校园跑腿', icon: icons.errands, lifeSection: 'errands' },
    ],
  },
]

export default function Services() {
  const [runtimeConfig, setRuntimeConfig] = useState(getMiniappRuntimeConfig)

  useDidShow(() => {
    void loadMiniappRuntimeConfig().then(setRuntimeConfig)
  })

  const openService = (item: ServiceItem) => {
    const moduleKey = serviceModules[item.key]
    if (item.lifeSection) {
      if (
        moduleKey
        && resolveMiniappModule(runtimeConfig, moduleKey).state === 'enabled'
      ) {
        Taro.setStorageSync(LIFE_HUB_SECTION_KEY, item.lifeSection)
      }
      if (moduleKey) {
        void openMiniappModule(
          moduleKey,
          '/pages/community/index',
          { tab: true, config: runtimeConfig },
        )
      }
      return
    }
    if (item.tab) {
      Taro.switchTab({ url: item.tab })
      return
    }
    if (item.route) {
      if (moduleKey) {
        void openMiniappModule(moduleKey, item.route, { config: runtimeConfig })
        return
      }
      Taro.navigateTo({ url: item.route })
      return
    }
    Taro.showToast({ title: `${item.name}入口配置异常`, icon: 'none' })
  }

  return (
    <View className='services-page'>
      <CustomNavbar title='全部服务' subtitle='中国海洋大学' showBack />
      <View className='services-page__content'>
        {groups.map((group) => {
          const items = group.items.filter((item) => {
            const moduleKey = serviceModules[item.key]
            return !moduleKey
              || resolveMiniappModule(runtimeConfig, moduleKey).state !== 'hidden'
          })
          if (!items.length) return null
          return (
          <View key={group.title} className='services-group'>
            <View className='services-group__head'>
              <View>
                <Text className='services-group__title'>{group.title}</Text>
                <Text className='services-group__subtitle'>{group.subtitle}</Text>
              </View>
              <Text className='services-group__count'>{items.length} 项</Text>
            </View>
            <View className='services-group__grid'>
              {items.map((item) => (
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
          )
        })}
      </View>
    </View>
  )
}
