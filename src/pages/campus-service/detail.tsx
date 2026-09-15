import { useState } from 'react'
import Taro, { useLoad } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import { CampusServiceItem, CampusServiceType, campusServiceData, isCampusServiceType } from './data'
import './index.scss'

export default function CampusServiceDetailPage() {
  const [type, setType] = useState<CampusServiceType>('study')
  const [item, setItem] = useState<CampusServiceItem | null>(campusServiceData.study.items[0])
  useLoad((options) => {
    if (options.type === 'campus-card') {
      Taro.redirectTo({ url: '/pages/services/index' })
      return
    }
    if (options.type === 'shuttle') {
      Taro.redirectTo({ url: '/pages/shuttle/index' })
      return
    }
    if (!isCampusServiceType(options.type)) return
    setType(options.type)
    setItem(campusServiceData[options.type].items.find((record) => record.id === options.id) || null)
  })
  const data = campusServiceData[type]
  const submit = async () => {
    const result = await Taro.showModal({
      title: data.action,
      content: item ? `确认针对“${item.title}”执行该操作吗？` : '确认执行该操作吗？',
      confirmColor: '#5d9f8b',
    })
    if (result.confirm) Taro.showToast({ title: '已处理', icon: 'success' })
  }
  return <View className='campus-service campus-service--detail'>
    <CustomNavbar title={`${data.title}详情`} subtitle='中国海洋大学' showBack />
    <View className='campus-detail'>
      {item ? <>
        <View className='campus-detail__hero'>
          <Text className='campus-detail__badge'>{item.badge}</Text>
          <Text className='campus-detail__title'>{item.title}</Text>
          <Text className='campus-detail__summary'>{item.summary}</Text>
          <Text className='campus-detail__meta'>{item.meta}</Text>
        </View>
        <View className='campus-detail__panel'>
          <Text className='campus-detail__heading'>详细信息</Text>
          {item.details.map(([label, value]) => <View key={label} className='campus-detail__row'><Text>{label}</Text><Text>{value}</Text></View>)}
        </View>
        <View className='campus-detail__notice'><Text>温馨提示</Text><Text>{item.notice}</Text></View>
        <View className='campus-detail__button' onClick={submit}>{data.action}</View>
      </> : <View className='campus-service-empty'><View /><Text>内容不存在或已下线</Text><Text onClick={() => Taro.navigateBack()}>返回上一页</Text></View>}
    </View>
  </View>
}
