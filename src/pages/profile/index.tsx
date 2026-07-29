import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Switch, Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import { KeyboardSafeInput } from '../../components/keyboard-safe-input'
import { getCurrentUser } from '../../api/account'
import { getAcademicVerificationStatus } from '../../api/academic-verification'
import type { AcademicVerificationStatus } from '../../api/types'
import { syncCustomTabBar } from '../../utils/tabbar'
import './index.scss'

const menus = [
  { key: 'schedule', name: '我的课表', meta: '本周 18 节', route: '/pages/academic/schedule/index' },
  { key: 'published', name: '我的发布', meta: '动态、跑腿、二手与拼车', route: '/pages/my-services/index?section=published' },
  { key: 'accepted', name: '我的接单', meta: '查看跑腿履约进度', route: '/pages/my-services/index?section=errands&relation=accepted' },
  { key: 'orders', name: '我的订单', meta: '二手与跑腿交易记录', route: '/pages/my-services/index?section=orders&relation=all' },
  { key: 'carpool', name: '我的拼车', meta: '我发起和参与的行程', route: '/pages/my-services/index?section=carpool&relation=all' },
  { key: 'campus-service', name: '服务记录', meta: '报修、预约与下载', route: '/pages/campus-service/index?type=repair' },
  { key: 'identity', name: '校园身份', meta: '查看认证状态', route: '/pages/academic-verification/index' },
  { key: 'favorites', name: '收藏与浏览', meta: '24 条收藏', action: 'favorites' },
] as const

export default function ProfilePage() {
  const [noticeEnabled, setNoticeEnabled] = useState(true)
  const [compactMode, setCompactMode] = useState(false)
  const [panel, setPanel] = useState<'favorites' | 'feedback' | null>(null)
  const [feedback, setFeedback] = useState('')
  const [academicStatus, setAcademicStatus] = useState<AcademicVerificationStatus | null>(null)
  useDidShow(() => {
    syncCustomTabBar(3)
    void Promise.all([
      getAcademicVerificationStatus(),
      getCurrentUser(),
    ]).then(([status]) => {
      setAcademicStatus(status)
    }).catch(() => {
      // 个人页保留可用，认证页会提供完整错误重试。
    })
  })
  const openMenu = (item: typeof menus[number]) => {
    if ('route' in item) Taro.navigateTo({ url: item.route })
    else setPanel(item.action)
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
  return <View className={`profile-page ${panel ? 'profile-page--locked' : ''}`}>
    <CustomNavbar title='我的海大' subtitle='中国海洋大学' />
    <View className='profile-page__content'>
      <View className='profile-card'><View className='profile-card__avatar'>海</View><View className='profile-card__main'><Text>{identity?.real_name || '海大同学'}</Text><Text>{identityVerified ? `学号 ${identity.student_no.slice(0, 2)}****${identity.student_no.slice(-2)}` : '中国海洋大学校园服务账号'}</Text><View className={identityVerified ? '' : 'profile-card__identity--guest'}>{identityMeta}</View></View></View>
      <View className='profile-stats'><View><Text>18</Text><Text>本周课程</Text></View><View><Text>3.76</Text><Text>平均绩点</Text></View><View><Text>实时</Text><Text>服务记录</Text></View></View>
      <Text className='profile-heading'>校园服务</Text>
      <View className='profile-menu'>{menus.map((item) => <View key={item.key} className={`profile-menu__${item.key}`} onClick={() => openMenu(item)}><View><Text>{item.name}</Text><Text>{item.name === '校园身份' ? identityMeta : item.meta}</Text></View><Text>›</Text></View>)}</View>
      <Text className='profile-heading'>偏好设置</Text>
      <View className='profile-settings'><View><View><Text>消息提醒</Text><Text>接收教务与服务进度通知</Text></View><Switch checked={noticeEnabled} color='#62a58e' onChange={(event) => setNoticeEnabled(event.detail.value)} /></View><View><View><Text>紧凑模式</Text><Text>在列表中展示更多内容</Text></View><Switch checked={compactMode} color='#62a58e' onChange={(event) => setCompactMode(event.detail.value)} /></View></View>
      <View className='profile-feedback' onClick={() => setPanel('feedback')}>设置与意见反馈</View>
    </View>
    {panel && <View className='profile-overlay' onClick={() => setPanel(null)}><View className='profile-sheet' onClick={(event) => event.stopPropagation()}><View className='profile-sheet__handle' />{panel === 'favorites' ? <><Text className='profile-sheet__title'>收藏与浏览</Text><View className='profile-favorite'><Text>高数复习资料互助帖</Text><Text>用户体验设计基础期中笔记</Text><Text>崂山校区 → 青岛北站拼车</Text></View></> : <><Text className='profile-sheet__title'>意见反馈</Text><Text className='profile-sheet__subtitle'>你的建议会帮助海大校园变得更好</Text><KeyboardSafeInput className='profile-feedback-input' value={feedback} onInput={(event) => setFeedback(event.detail.value)} maxlength={120} placeholder='写下问题或建议' /></>}<View className='profile-sheet__button' onClick={() => { if (panel === 'feedback' && !feedback.trim()) return Taro.showToast({ title: '请填写反馈内容', icon: 'none' }); if (panel === 'feedback') { setFeedback(''); Taro.showToast({ title: '反馈已提交', icon: 'success' }) } setPanel(null) }}>{panel === 'feedback' ? '提交反馈' : '完成'}</View></View></View>}
  </View>
}
