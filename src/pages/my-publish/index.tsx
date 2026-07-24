import { Button, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { ContentType, getMyPublications, login, MyPublication } from '../../services/api'
import './index.scss'

const typeLabels: Record<ContentType, string> = {
  activity: '活动',
  'campus-circle': '校园圈',
  marketplace: '二手',
  errand: '跑腿',
  carpool: '拼车'
}

function reviewState (item: MyPublication) {
  const value = item.review_status || item.status || ''
  if (value === 'draft') return { label: '草稿', className: 'draft' }
  if (value === 'pending' || value === 'pending_review' || value === 'under_review') return { label: '审核中', className: 'pending' }
  if (value === 'rejected') return { label: '已驳回', className: 'rejected' }
  if (value === 'approved' || value === 'published' || value === 'active' || value === 'open') return { label: '已通过', className: 'approved' }
  return { label: value || '处理中', className: 'pending' }
}

export default function MyPublish () {
  const [items, setItems] = useState<MyPublication[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    if (!Taro.getStorageSync('access_token')) {
      setError('请先登录后查看我的发布')
      return
    }
    setLoading(true)
    setError('')
    try {
      setItems(await getMyPublications())
    } catch (requestError) {
      setError((requestError as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useDidShow(() => { void load() })

  const doLogin = async () => {
    try {
      await login()
      await load()
    } catch (loginError) {
      setError((loginError as Error).message)
    }
  }

  const open = (item: MyPublication) => Taro.navigateTo({ url: `/pages/detail/index?type=${item.type}&id=${item.id}&mine=1` })

  return <View className='my-publish-page'>
    <View className='my-publish-header'>
      <Text className='page-title'>我的发布</Text>
      <Text className='page-subtitle'>审核中内容仅你自己可见</Text>
    </View>
    {loading && <Text className='state-hint'>正在加载…</Text>}
    {!loading && error && <View className='state-card'><Text>{error}</Text>{!Taro.getStorageSync('access_token') && <Button size='mini' onClick={() => void doLogin()}>微信登录</Button>}<Button size='mini' onClick={() => void load()}>重试</Button></View>}
    {!loading && !error && !items.length && <View className='state-card'><Text>还没有发布内容</Text><Button size='mini' onClick={() => Taro.navigateTo({ url: '/pages/publish/index?type=campus-circle' })}>去发布</Button></View>}
    <View className='publication-list'>
      {items.map(item => {
        const state = reviewState(item)
        return <View className='publication-card' key={`${item.type}-${item.id}`} onClick={() => open(item)}>
          <View className='publication-top'>
            <Text className='type-pill'>{typeLabels[item.type]}</Text>
            <Text className={`status-pill ${state.className}`}>{state.label}</Text>
          </View>
          <Text className='publication-title'>{item.title}</Text>
          <Text className='publication-summary'>{item.summary || '暂无描述'}</Text>
          {state.className === 'rejected' && item.review_reason && <Text className='rejection-reason'>驳回原因：{item.review_reason}</Text>}
          <Text className='publication-time'>{item.updated_at ? `更新于 ${item.updated_at.replace('T', ' ').slice(0, 16)}` : ''} ›</Text>
        </View>
      })}
    </View>
  </View>
}
