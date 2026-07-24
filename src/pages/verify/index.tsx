import { View, Text, Input, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { getAcademicStatus, login, verifyCredentials } from '../../services/api'
import './index.scss'

export default function Verify () {
  const [studentNo, setStudentNo] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async () => {
    if (!studentNo.trim() || !password) { setStatus('请输入学号和教务密码'); return }
    setLoading(true); setStatus('正在由服务端校验教务凭据…')
    try {
      if (!Taro.getStorageSync('access_token')) await login()
      await verifyCredentials(studentNo.trim(), password)
      setPassword(''); setStatus('认证成功，可以发布和参与校园内容了')
    } catch (e) { setStatus((e as Error).message) } finally { setLoading(false) }
  }
  const refresh = async () => { try { const data = await getAcademicStatus(); setStatus(data.identity ? '当前已认证' : `当前状态：${data.latest_request?.status || '未认证'}`) } catch (e) { setStatus((e as Error).message) } }
  return <View className='verify'><Text className='heading'>教务认证</Text><Text className='description'>认证信息只用于服务端校验，密码不会保存。</Text><View className='form'><Input value={studentNo} onInput={e => setStudentNo(e.detail.value)} placeholder='学号' maxlength={64} /><Input value={password} onInput={e => setPassword(e.detail.value)} password placeholder='教务密码' maxlength={256} /><Button type='primary' loading={loading} onClick={() => void submit()}>服务端验证</Button><Button onClick={() => Taro.showToast({ title: '本地爬虫证明入口将在后续版本接入', icon: 'none' })}>使用本地爬虫结果</Button><Button size='mini' onClick={() => void refresh()}>查询当前状态</Button></View><Text className='status'>{status}</Text></View>
}
