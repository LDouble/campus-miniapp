import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import { getAcademicVerificationStatus } from '../../api/academic-verification'
import type { AcademicVerificationStatus } from '../../api/types'
import { syncCustomTabBar } from '../../utils/tabbar'
import './index.scss'

const menus = [
  { key: 'schedule', name: '我的课表', meta: '查看课程安排', route: '/pages/academic/schedule/index' },
  { key: 'materials', name: '我的资料', meta: '上传草稿与审核进度', route: '/pages/materials/index?view=mine' },
  { key: 'published', name: '我的发布', meta: '动态、跑腿、二手与拼车', route: '/pages/my-services/index?section=published' },
  { key: 'accepted', name: '我的接单', meta: '查看跑腿履约进度', route: '/pages/my-services/index?section=errands&relation=accepted' },
  { key: 'orders', name: '我的订单', meta: '二手与跑腿交易记录', route: '/pages/my-services/index?section=orders&relation=all' },
  { key: 'carpool', name: '我的拼车', meta: '我发起和参与的行程', route: '/pages/my-services/index?section=carpool&relation=all' },
  { key: 'identity', name: '校园身份', meta: '查看认证状态', route: '/pages/academic-verification/index' },
] as const

export default function ProfilePage() {
  const [academicStatus, setAcademicStatus] = useState<AcademicVerificationStatus | null>(null)
  useDidShow(() => {
    syncCustomTabBar(3)
    void getAcademicVerificationStatus().then((status) => {
      setAcademicStatus(status)
    }).catch(() => {
      // 个人页保留可用，认证页会提供完整错误重试。
    })
  })
  const openMenu = (item: typeof menus[number]) => {
    Taro.navigateTo({ url: item.route })
  }
  const identity = academicStatus?.identity
  const latestRequest = academicStatus?.latest_request
  const identityVerified = identity?.status === 'verified'
  const identityPending = !identityVerified && latestRequest?.status === 'pending'
  const identityMeta = identityVerified
    ? `已认证 · ${identity?.method === 'credentials' ? '教务账号' : '学生证'}`
    : identityPending
      ? '学生证审核中'
      : latestRequest?.status === 'rejected'
        ? '认证未通过，点击处理'
        : 'Guest · 待认证'
  return <View className='profile-page'>
    <CustomNavbar title='我的海大' subtitle='中国海洋大学' />
    <View className='profile-page__content'>
      <View className='profile-card'><View className='profile-card__avatar'>海</View><View className='profile-card__main'><Text>{identity?.real_name || '海大同学'}</Text><Text>{identityVerified ? `学号 ${identity.student_no.slice(0, 2)}****${identity.student_no.slice(-2)}` : '中国海洋大学校园服务账号'}</Text><View className={identityVerified ? '' : 'profile-card__identity--guest'}>{identityMeta}</View></View></View>
      <Text className='profile-heading'>校园服务</Text>
      <View className='profile-menu'>{menus.map((item) => <View key={item.key} className={`profile-menu__${item.key}`} onClick={() => openMenu(item)}><View><Text>{item.name}</Text><Text>{item.name === '校园身份' ? identityMeta : item.meta}</Text></View><Text>›</Text></View>)}</View>
    </View>
  </View>
}
