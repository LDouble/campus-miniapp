import { useMemo, useState } from 'react'
import Taro, { useLoad } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import { CampusServiceType, campusServiceData, isCampusServiceType } from './data'
import './index.scss'

export default function CampusServicePage() {
  const [type, setType] = useState<CampusServiceType>('study')
  const [activeFilter, setActiveFilter] = useState(0)
  useLoad((options) => {
    if (options.type === 'calendar') {
      Taro.redirectTo({ url: '/pages/calendar/index' })
      return
    }
    if (options.type === 'shuttle') {
      Taro.redirectTo({ url: '/pages/shuttle/index' })
      return
    }
    if (options.type === 'classroom') {
      Taro.redirectTo({ url: '/pages/empty-classroom/index' })
      return
    }
    if (isCampusServiceType(options.type)) setType(options.type)
  })
  const data = campusServiceData[type]
  const visibleItems = useMemo(() => {
    if (activeFilter === 0) return data.items
    const keyword = data.filters[activeFilter]
    const matched = data.items.filter((item) => `${item.title}${item.badge}${item.summary}${item.meta}`.includes(keyword))
    return matched.length ? matched : data.items
  }, [activeFilter, data])

  const runAction = async () => {
    const result = await Taro.showModal({
      title: data.action,
      content: `确认发起“${data.action}”操作吗？本阶段将以 Mock 方式完成交互闭环。`,
      confirmColor: '#5d9f8b',
    })
    if (result.confirm) Taro.showToast({ title: '操作已提交', icon: 'success' })
  }

  return <View className={`campus-service campus-service--${type}`}>
    <CustomNavbar title={data.title} subtitle='中国海洋大学' showBack />
    <View className='campus-service__content'>
      <View className='campus-service-hero'>
        <View>
          <Text className='campus-service-hero__subtitle'>{data.subtitle}</Text>
          <Text className='campus-service-hero__title'>{data.hero}</Text>
        </View>
        <View className='campus-service-hero__metric'>
          <Text>{data.metric}</Text><Text>{data.metricLabel}</Text>
        </View>
      </View>
      <View className='campus-service-filters'>
        {data.filters.map((filter, index) => <View key={filter} className={activeFilter === index ? 'campus-service-filters__active' : ''} onClick={() => setActiveFilter(index)}>{filter}</View>)}
      </View>
      <View className='campus-service-heading'><Text>服务信息</Text><Text>{visibleItems.length} 条</Text></View>
      {visibleItems.map((item) => <View key={item.id} className='campus-service-card' onClick={() => Taro.navigateTo({ url: `/pages/campus-service/detail?type=${type}&id=${item.id}` })}>
        <View className='campus-service-card__top'><Text>{item.title}</Text><Text>{item.badge}</Text></View>
        <Text className='campus-service-card__summary'>{item.summary}</Text>
        <View className='campus-service-card__bottom'><Text>{item.meta}</Text><Text>查看详情 ›</Text></View>
      </View>)}
      {!visibleItems.length && <View className='campus-service-empty'><View /><Text>暂无相关信息</Text><Text>稍后再来看看</Text></View>}
    </View>
    <View className='campus-service-action' onClick={runAction}>{data.action}</View>
  </View>
}
