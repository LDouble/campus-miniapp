import { Button, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { DesignIcon } from '../../components/DesignIcon'
import { useNavigationMetrics } from '../../hooks/useNavigationMetrics'
import { AcademicStatus, getAcademicStatus, login } from '../../services/api'
import { syncCustomTabBar } from '../../utils/tabbar'
import './index.scss'

const shortcuts = [
  { name: '我的发布', icon: 'edit' },
  { name: '我的参与', icon: 'check' },
  { name: '我的收藏', icon: 'heart' },
  { name: '浏览记录', icon: 'chart' }
]

const services = [
  { name: '账号与安全', icon: 'shield' },
  { name: '消息设置', icon: 'bell' },
  { name: '帮助与反馈', icon: 'help' },
  { name: '关于校园生活', icon: 'info' }
]

const verificationCopy: Record<string, string> = {
  pending: '认证资料审核中',
  rejected: '认证未通过，请修改后重试',
  approved: '已完成校园身份认证'
}

export default function Mine () {
  const [status, setStatus] = useState<AcademicStatus | null>(null)
  const [loggedIn, setLoggedIn] = useState(false)
  const [message, setMessage] = useState('')
  const { topInset } = useNavigationMetrics()

  const loadStatus = async () => {
    const hasToken = Boolean(Taro.getStorageSync('access_token'))
    setLoggedIn(hasToken)
    if (!hasToken) {
      setStatus(null)
      return
    }
    try {
      setStatus(await getAcademicStatus())
    } catch (_) {
      setStatus(null)
    }
  }

  useDidShow(() => {
    syncCustomTabBar(2)
    void loadStatus()
  })

  const doLogin = async () => {
    setMessage('')
    try {
      await login()
      await loadStatus()
      Taro.showToast({ title: '登录成功', icon: 'success' })
    } catch (error) {
      setMessage((error as Error).message)
    }
  }

  const openVerification = () => Taro.navigateTo({ url: '/pages/verify/index' })
  const showComingSoon = (name: string) => Taro.showToast({ title: `${name}即将开放`, icon: 'none' })
  const requestStatus = status?.latest_request?.status || ''
  const verified = Boolean(status?.identity)
  const verificationText = verified
    ? verificationCopy.approved
    : verificationCopy[requestStatus] || '完成认证后可发布和参与校园内容'

  return <View className='mine-page'>
    <View className='mine-glow mine-glow-primary' />
    <View className='mine-glow mine-glow-secondary' />

    <View className='mine-header' style={{ paddingTop: `${topInset + 8}px` }}>
      <View>
        <Text className='mine-eyebrow'>PERSONAL CENTER</Text>
        <Text className='mine-title'>我的</Text>
      </View>
      <View className='header-action' onClick={() => showComingSoon('设置')}>
        <DesignIcon name='settings' />
      </View>
    </View>

    <View className='mine-scroll'>
      <View className='profile-card'>
        <View className='profile-orbit' />
        <View className='profile-main'>
          <View className='avatar-wrap'>
            <View className='avatar'>校</View>
            <View className={`identity-dot ${verified ? 'verified' : ''}`} />
          </View>
          <View className='profile-copy'>
            <Text className='profile-name'>{loggedIn ? '校园用户' : '欢迎来到校园生活'}</Text>
            <Text className='profile-meta'>{loggedIn ? (verified ? '已认证校园成员' : '登录成功，待完成身份认证') : '登录后同步你的校园足迹'}</Text>
          </View>
          {loggedIn
            ? <View className='profile-arrow' onClick={() => showComingSoon('个人资料')}>›</View>
            : <Button className='login-button' onClick={() => void doLogin()}>微信登录</Button>}
        </View>

        <View className='profile-stats'>
          <View><Text className='stat-value'>0</Text><Text className='stat-label'>发布</Text></View>
          <View><Text className='stat-value'>0</Text><Text className='stat-label'>参与</Text></View>
          <View><Text className='stat-value'>0</Text><Text className='stat-label'>收藏</Text></View>
        </View>
      </View>

      <View className={`verification-card ${verified ? 'is-verified' : ''}`} onClick={openVerification}>
        <View className='verification-icon'><DesignIcon name={verified ? 'check' : 'card'} /></View>
        <View className='verification-copy'>
          <View className='verification-title-row'>
            <Text className='verification-title'>教务身份认证</Text>
            <Text className='verification-badge'>{verified ? '已认证' : requestStatus === 'pending' ? '审核中' : '待完成'}</Text>
          </View>
          <Text className='verification-description'>{verificationText}</Text>
          {requestStatus === 'rejected' && status?.latest_request?.review_reason && <Text className='verification-reason'>原因：{status.latest_request.review_reason}</Text>}
        </View>
        <Text className='row-arrow'>›</Text>
      </View>

      <View className='mine-section'>
        <View className='section-heading'><Text>我的校园</Text><Text>记录每一次校园参与</Text></View>
        <View className='shortcut-grid'>
          {shortcuts.map(item => <View className='shortcut-item' key={item.name} onClick={() => showComingSoon(item.name)}>
            <View className='shortcut-icon'><DesignIcon name={item.icon} /></View>
            <Text>{item.name}</Text>
          </View>)}
        </View>
      </View>

      <View className='service-card'>
        {services.map((item, index) => <View className='service-row' key={item.name} onClick={() => showComingSoon(item.name)}>
          <View className={`service-icon service-icon-${index + 1}`}><DesignIcon name={item.icon} /></View>
          <Text className='service-name'>{item.name}</Text>
          <Text className='row-arrow'>›</Text>
        </View>)}
      </View>

      {message && <Text className='mine-message'>{message}</Text>}
      <Text className='mine-version'>校园生活 · 让校园连接更简单</Text>
    </View>
  </View>
}
