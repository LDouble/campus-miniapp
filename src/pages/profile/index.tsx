import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import { getAcademicVerificationStatus } from '../../api/academic-verification'
import type { AcademicVerificationStatus } from '../../api/types'
import { syncCustomTabBar } from '../../utils/tabbar'
import './index.scss'

const icons = {
  arrow: require('../../assets/icons/arrow.svg'),
  schedule: require('../../assets/icons/calendar.svg'),
  materials: require('../../assets/icons/materials.svg'),
  published: require('../../assets/icons/community.svg'),
  accepted: require('../../assets/icons/errands.svg'),
  orders: require('../../assets/icons/market.svg'),
  carpool: require('../../assets/icons/shuttle.svg'),
  identity: require('../../assets/icons/academic.svg'),
}

const menus = [
  {
    key: 'schedule',
    name: '我的课表',
    icon: icons.schedule,
    route: '/pages/academic/schedule/index',
  },
  {
    key: 'materials',
    name: '我的资料',
    icon: icons.materials,
    route: '/pages/materials/index?view=mine',
  },
  {
    key: 'published',
    name: '我的发布',
    icon: icons.published,
    route: '/pages/my-services/index?section=published',
  },
  {
    key: 'accepted',
    name: '我的接单',
    icon: icons.accepted,
    route: '/pages/my-services/index?section=errands&relation=accepted',
  },
  {
    key: 'orders',
    name: '我的订单',
    icon: icons.orders,
    route: '/pages/my-services/index?section=orders&relation=all',
  },
  {
    key: 'carpool',
    name: '我的拼车',
    icon: icons.carpool,
    route: '/pages/my-services/index?section=carpool&relation=all',
  },
] as const

const identityMenu = {
  key: 'identity',
  name: '校园身份',
  icon: icons.identity,
  route: '/pages/academic-verification/index',
} as const

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
  const openMenu = (item: typeof menus[number] | typeof identityMenu) => {
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
        : '待认证'
  const studentNumber = identityVerified
    ? `${identity.student_no.slice(0, 2)}****${identity.student_no.slice(-2)}`
    : ''

  return (
    <View className='profile-page'>
      <View className='profile-page__orb profile-page__orb--warm' />
      <View className='profile-page__orb profile-page__orb--teal' />
      <CustomNavbar title='我的海大' subtitle='中国海洋大学' />

      <View className='profile-page__content'>
        <View className='profile-card motion-enter'>
          <View className='profile-card__avatar'>
            <Text>{(identity?.real_name || '海大同学').slice(0, 1)}</Text>
            <View className='profile-card__status' />
          </View>
          <View className='profile-card__main'>
            <Text className='profile-card__name'>
              {identity?.real_name || '海大同学'}
            </Text>
            <Text className='profile-card__school'>
              {studentNumber ? `学号 ${studentNumber}` : '中国海洋大学校园服务账号'}
            </Text>
          </View>
          <View
            className={[
              'profile-card__badge',
              identityVerified ? 'profile-card__badge--verified' : '',
            ].filter(Boolean).join(' ')}
            hoverClass='profile-card__badge--pressed'
            ariaRole='button'
            ariaLabel={`校园身份，${identityMeta}`}
            onClick={() => openMenu(identityMenu)}
          >
            <Text>{identityVerified ? '已认证' : '去认证'}</Text>
            <Image src={icons.arrow} mode='aspectFit' />
          </View>
        </View>

        <View className='profile-section motion-enter motion-enter--delay-1'>
          <View className='profile-section__head'>
            <Text className='profile-section__title'>我的服务</Text>
            <Text className='profile-section__hint'>常用记录，一步直达</Text>
          </View>
          <View className='profile-menu'>
            {menus.map((item) => (
              <View
                key={item.key}
                className={`profile-menu__item profile-menu__item--${item.key}`}
                hoverClass='profile-menu__item--pressed'
                ariaRole='button'
                ariaLabel={item.name}
                onClick={() => openMenu(item)}
              >
                <View className='profile-menu__icon'>
                  <Image src={item.icon} mode='aspectFit' />
                </View>
                <Text>{item.name}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className='profile-section motion-enter motion-enter--delay-2'>
          <Text className='profile-section__title'>账号与身份</Text>
          <View
            className='profile-identity-entry'
            hoverClass='profile-identity-entry--pressed'
            ariaRole='button'
            ariaLabel={`校园身份，${identityMeta}`}
            onClick={() => openMenu(identityMenu)}
          >
            <View className='profile-identity-entry__icon'>
              <Image src={identityMenu.icon} mode='aspectFit' />
            </View>
            <View className='profile-identity-entry__main'>
              <Text>{identityMenu.name}</Text>
              <Text>{identityMeta}</Text>
            </View>
            <Image
              className='profile-identity-entry__arrow'
              src={icons.arrow}
              mode='aspectFit'
            />
          </View>
        </View>
      </View>
    </View>
  )
}
