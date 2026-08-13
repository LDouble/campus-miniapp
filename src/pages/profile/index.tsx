import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import { getAcademicVerificationStatus } from '../../api/academic-verification'
import type {
  AcademicVerificationStatus,
  DailyCheckinStatus,
  UserLevelSummary,
} from '../../api/types'
import { getMyUserLevel } from '../../api/user-levels'
import { getMyDailyCheckinStatus } from '../../api/daily-checkins'
import { openMiniProgramPrivacyContract } from '../../features/privacy/contract'
import { isQualificationEdition } from '../../features/app-edition'
import { syncCustomTabBar } from '../../utils/tabbar'
import './index.scss'

const icons = {
  arrow: require('../../assets/icons/arrow.svg'),
  schedule: require('../../assets/icons/calendar.svg'),
  materials: require('../../assets/icons/materials.svg'),
  published: require('../../assets/icons/community.svg'),
  accepted: require('../../assets/icons/errands.svg'),
  orders: require('../../assets/icons/market.svg'),
  earnings: require('../../assets/icons/result.svg'),
  carpool: require('../../assets/icons/shuttle.svg'),
  identity: require('../../assets/icons/academic.svg'),
  privacy: require('../../assets/icons/study.svg'),
  account: require('../../assets/icons/profile.svg'),
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
    key: 'earnings',
    name: '我的收益',
    icon: icons.earnings,
    route: '/pages/earnings/index',
  },
  {
    key: 'carpool',
    name: '我的拼车',
    icon: icons.carpool,
    route: '/pages/my-services/index?section=carpool&relation=all',
  },
] as const

const visibleMenus = isQualificationEdition
  ? menus.filter((item) => item.key === 'schedule')
  : menus

const identityMenu = {
  key: 'identity',
  name: '校园身份',
  icon: icons.identity,
  route: '/pages/academic-verification/index',
} as const

export default function ProfilePage() {
  const [academicStatus, setAcademicStatus] = useState<AcademicVerificationStatus | null>(null)
  const [userLevel, setUserLevel] = useState<UserLevelSummary | null>(null)
  const [checkinStatus, setCheckinStatus] = useState<DailyCheckinStatus | null>(null)
  useDidShow(() => {
    syncCustomTabBar('profile')
    setCheckinStatus(null)
    void getAcademicVerificationStatus().then((status) => {
      setAcademicStatus(status)
    }).catch(() => {
      // 个人页保留可用，认证页会提供完整错误重试。
    })
    void getMyUserLevel().then(setUserLevel).catch(() => {
      // 等级信息不影响个人中心其余入口。
    })
    void getMyDailyCheckinStatus().then(setCheckinStatus).catch(() => {
      // 签到状态失败时仍保留入口，详情页提供完整错误重试。
    })
  })
  const openMenu = (item: typeof menus[number] | typeof identityMenu) => {
    Taro.navigateTo({ url: item.route })
  }
  const openPrivacy = async () => {
    try {
      await openMiniProgramPrivacyContract()
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '隐私保护指引暂不可用',
        icon: 'none',
      })
    }
  }
  const identity = academicStatus?.identity
  const latestRequest = academicStatus?.latest_request
  const identityVerified = identity?.status === 'verified'
  const identityPending = !identityVerified && latestRequest?.status === 'pending'
  const identityMeta = identityVerified
    ? `已认证 · ${identity?.method === 'credentials' ? '教务账号' : '学生证'}`
    : identityPending
      ? '校园身份认证中'
      : latestRequest?.status === 'rejected'
        ? '认证未通过，点击处理'
        : '待认证'
  const identityBadgeText = identityVerified
    ? '已认证'
    : identityPending
      ? '认证中'
      : '去认证'
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
          <View className='profile-card__actions'>
            <View
              className={[
                'profile-card__badge',
                identityVerified ? 'profile-card__badge--verified' : '',
                identityPending ? 'profile-card__badge--pending' : '',
              ].filter(Boolean).join(' ')}
              hoverClass='profile-card__badge--pressed'
              ariaRole='button'
              ariaLabel={`校园身份，${identityMeta}`}
              onClick={() => openMenu(identityMenu)}
            >
              <Text>{identityBadgeText}</Text>
              <Image src={icons.arrow} mode='aspectFit' />
            </View>
            <View
              className={[
                'profile-card__checkin',
                checkinStatus?.checked_in ? 'profile-card__checkin--done' : '',
              ].filter(Boolean).join(' ')}
              hoverClass='profile-card__checkin--pressed'
              ariaRole='button'
              ariaLabel={checkinStatus?.checked_in ? '今日已签到，查看签到记录' : '前往每日签到'}
              onClick={() => Taro.navigateTo({ url: '/pages/daily-checkin/index' })}
            >
              <View />
              <Text>
                {checkinStatus?.checked_in
                  ? '已签到'
                  : checkinStatus?.enabled === false
                    ? '签到'
                    : '去签到'}
              </Text>
            </View>
          </View>
        </View>

        {userLevel && (
          <View
            className={`profile-level profile-level--${userLevel.theme} motion-enter motion-enter--delay-1`}
            hoverClass='profile-level--pressed'
            ariaRole='button'
            ariaLabel={`社区等级，Lv.${userLevel.level} ${userLevel.name}`}
            onClick={() => Taro.navigateTo({ url: '/pages/user-level/index' })}
          >
            <View className='profile-level__head'>
              <View>
                <Text>社区贡献等级</Text>
                <Text>Lv.{userLevel.level} · {userLevel.name}</Text>
              </View>
              <View className='profile-level__experience'>
                <Text>{userLevel.experience}</Text>
                <Text>经验</Text>
              </View>
            </View>
            <View className='profile-level__track'>
              <View style={{ width: `${Math.max(0, Math.min(100, userLevel.progress_percent))}%` }} />
            </View>
            <View className='profile-level__foot'>
              <Text>{userLevel.description}</Text>
              <Text>
                {userLevel.is_max_level
                  ? '已达最高等级'
                  : `还差 ${userLevel.experience_to_next} 经验升级`}
              </Text>
            </View>
          </View>
        )}

        <View className='profile-section motion-enter motion-enter--delay-2'>
          <View className='profile-section__head'>
            <Text className='profile-section__title'>我的服务</Text>
            <Text className='profile-section__hint'>常用记录，一步直达</Text>
          </View>
          <View className='profile-menu'>
            {visibleMenus.map((item) => (
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

        <View className='profile-section motion-enter motion-enter--delay-3'>
          <Text className='profile-section__title'>账号与身份</Text>
          <View className='profile-account-list'>
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

            <View
              className='profile-identity-entry'
              hoverClass='profile-identity-entry--pressed'
              ariaRole='button'
              ariaLabel='查看小程序用户隐私保护指引'
              onClick={() => void openPrivacy()}
            >
              <View className='profile-identity-entry__icon profile-identity-entry__icon--privacy'>
                <Image src={icons.privacy} mode='aspectFit' />
              </View>
              <View className='profile-identity-entry__main'>
                <Text>隐私保护指引</Text>
                <Text>查看微信官方隐私协议</Text>
              </View>
              <Image
                className='profile-identity-entry__arrow'
                src={icons.arrow}
                mode='aspectFit'
              />
            </View>

            <View
              className='profile-identity-entry profile-identity-entry--danger'
              hoverClass='profile-identity-entry--pressed'
              ariaRole='button'
              ariaLabel='注销当前账号'
              onClick={() => Taro.navigateTo({ url: '/pages/account-cancellation/index' })}
            >
              <View className='profile-identity-entry__icon'>
                <Image src={icons.account} mode='aspectFit' />
              </View>
              <View className='profile-identity-entry__main'>
                <Text>注销账号</Text>
                <Text>匿名化账号并解绑教务</Text>
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
    </View>
  )
}
