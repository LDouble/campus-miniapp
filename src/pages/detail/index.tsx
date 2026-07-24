import { View, Text, Button } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import { ContentType, FeedItem, getAcademicStatus, getDetail } from '../../services/api'
import './index.scss'

export default function Detail () {
  const [item, setItem] = useState<FeedItem | null>(null)
  const [error, setError] = useState('')
  useLoad(async (params) => {
    try { setItem(await getDetail(params.type as ContentType, Number(params.id))) } catch (e) { setError((e as Error).message) }
  })
  const action = async (name: string) => {
    if (name === 'verify_academic') { try { const status = await getAcademicStatus(); if (!status.identity) Taro.navigateTo({ url: '/pages/verify/index' }) } catch (_) { Taro.navigateTo({ url: '/pages/verify/index' }) } return }
    Taro.showToast({ title: '该操作将在下一阶段开放', icon: 'none' })
  }
  if (error) return <View className='detail empty'><Text>{error}</Text></View>
  if (!item) return <View className='detail empty'><Text>正在加载…</Text></View>
  return <View className='detail'><View className='detail-card'><Text className='type'>{item.type}</Text><Text className='title'>{item.title}</Text><Text className='content'>{item.summary || '暂无详细内容'}</Text><View className='meta'><Text>状态：{item.review_status || item.status || '公开'}</Text></View></View><View className='actions'>{(item.available_actions || []).map(name => <Button key={name} size='mini' onClick={() => void action(name)}>{name === 'verify_academic' ? '完成教务认证' : name}</Button>)}</View></View>
}
