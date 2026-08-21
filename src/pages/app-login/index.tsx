import { useState } from 'react'
import Taro, { useLoad } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import { openMiniProgramPrivacyContract } from '../../features/privacy/contract'
import './index.scss'

type Status = 'ready' | 'loading' | 'error'

type WechatAppBridge = {
  navigateBackApplication?: (options: {
    extraData: string
    success?: () => void
    fail?: (result: { errMsg?: string }) => void
  }) => void
}

const getWechatAppBridge = () => (
  (globalThis as typeof globalThis & { wx?: WechatAppBridge }).wx
)

export default function AppLoginPage() {
  const [state, setState] = useState('')
  const [status, setStatus] = useState<Status>('ready')
  const [message, setMessage] = useState('确认后将安全返回海大校园 App')

  useLoad((options) => {
    setState(String(options.state || '').trim())
  })

  const authorize = async () => {
    if (status === 'loading') return
    if (!state) {
      setStatus('error')
      setMessage('登录请求已失效，请返回 App 重新发起')
      return
    }
    if (Taro.getEnv() !== Taro.ENV_TYPE.WEAPP) {
      setStatus('error')
      setMessage('请在微信小程序中完成授权')
      return
    }
    const bridge = getWechatAppBridge()
    if (!bridge?.navigateBackApplication) {
      setStatus('error')
      setMessage('请从最新版海大校园 App 打开本页面')
      return
    }

    setStatus('loading')
    setMessage('正在获取微信一次性授权凭证…')
    try {
      const loginResult = await Taro.login()
      if (!loginResult.code) throw new Error('微信登录凭证获取失败')
      const extraData = JSON.stringify({
        type: 'campus_wechat_login',
        state,
        code: loginResult.code,
      })
      await new Promise<void>((resolve, reject) => {
        bridge.navigateBackApplication?.({
          extraData,
          success: resolve,
          fail: (failure) => reject(new Error(failure.errMsg || '无法返回 App')),
        })
      })
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : '授权失败，请重新尝试')
    }
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

  return <View className='app-login'>
    <CustomNavbar title='微信授权登录' subtitle='海大校园' />
    <View className='app-login__content'>
      <View className='app-login__mark'>
        <Text>海</Text>
      </View>
      <Text className='app-login__title'>登录海大校园 App</Text>
      <Text className='app-login__subtitle'>使用当前微信身份连接校园账号</Text>

      <View className='app-login__panel'>
        <View className='app-login__row'>
          <Text className='app-login__number'>1</Text>
          <View><Text>微信身份授权</Text><Text>仅获取一次性登录凭证</Text></View>
        </View>
        <View className='app-login__divider' />
        <View className='app-login__row'>
          <Text className='app-login__number'>2</Text>
          <View><Text>自动返回 App</Text><Text>无需复制或填写任何内容</Text></View>
        </View>
      </View>

      <View className={`app-login__message app-login__message--${status}`}>
        <View />
        <Text>{message}</Text>
      </View>

      <View
        className={`app-login__button ${status === 'loading' ? 'app-login__button--loading' : ''}`}
        onClick={authorize}
      >
        {status === 'loading' && <View className='app-login__spinner' />}
        <Text>{status === 'loading' ? '正在授权' : '微信授权并返回 App'}</Text>
      </View>
      <View className='app-login__privacy'>
        <Text>继续即表示你已阅读</Text>
        <Text onClick={() => void openPrivacy()}>小程序用户隐私保护指引</Text>
      </View>
    </View>
  </View>
}
