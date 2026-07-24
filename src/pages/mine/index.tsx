import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { AcademicStatus, getAcademicStatus, login } from '../../services/api'
import './index.scss'

export default function Mine () {
  const [status, setStatus] = useState<AcademicStatus | null>(null)
  const [message, setMessage] = useState('')
  useDidShow(() => { void (async () => { try { setStatus(await getAcademicStatus()) } catch (_) {} })() })
  const doLogin = async () => { try { await login(); setStatus(await getAcademicStatus()); setMessage('登录成功') } catch (e) { setMessage((e as Error).message) } }
  return <View className='mine'><View className='profile'><Text className='avatar'>校</Text><View><Text className='welcome'>校园用户</Text><Text className='muted'>{Taro.getStorageSync('access_token') ? '已登录' : '未登录'}</Text></View></View><View className='verify-card'><Text className='card-title'>教务认证</Text><Text className='muted'>{status?.identity ? '已认证，可参与校园内容' : `未认证${status?.latest_request?.status ? `（${status.latest_request.status}）` : ''}`}</Text><Button size='mini' onClick={() => Taro.navigateTo({ url: '/pages/verify/index' })}>去认证</Button></View>{!Taro.getStorageSync('access_token') && <Button type='primary' onClick={() => void doLogin()}>微信登录</Button>}<Text className='message'>{message}</Text></View>
}
