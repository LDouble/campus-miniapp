import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useState } from 'react'
import { FeedItem, getAcademicStatus, getFeed, login } from '../../services/api'
import './index.scss'

export default function Index () {
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = async () => {
    setLoading(true); setError('')
    try { setItems(await getFeed()) } catch (e) { setError((e as Error).message) } finally { setLoading(false); Taro.stopPullDownRefresh() }
  }
  useDidShow(() => { void load() })
  usePullDownRefresh(() => { void load() })
  const openDetail = (item: FeedItem) => Taro.navigateTo({ url: `/pages/detail/index?type=${item.type}&id=${item.id}` })
  const ensureLogin = async () => { try { await login(); await load() } catch (e) { setError((e as Error).message) } }
  const verify = async () => { try { const status = await getAcademicStatus(); if (status.identity) Taro.showToast({ title: '已完成认证', icon: 'none' }); else Taro.navigateTo({ url: '/pages/verify/index' }) } catch (_) { Taro.navigateTo({ url: '/pages/verify/index' }) } }
  return <View className='home'>
    <View className='hero'><Text className='eyebrow'>CAMPUS PLATFORM</Text><Text className='headline'>校园生活，一站解决</Text><Text className='subhead'>活动、二手、跑腿和拼车</Text></View>
    <View className='toolbar'><Text className='section-title'>最新内容</Text><Button size='mini' onClick={verify}>教务认证</Button></View>
    {loading && <Text className='hint'>正在加载内容…</Text>}
    {!loading && error && <View className='empty'><Text>{error}</Text><Button size='mini' onClick={ensureLogin}>微信登录并重试</Button></View>}
    {!loading && !error && items.length === 0 && <View className='empty'><Text>暂时没有公开内容</Text><Button size='mini' onClick={ensureLogin}>登录后刷新</Button></View>}
    {items.map(item => <View className='card' key={`${item.type}-${item.id}`} onClick={() => openDetail(item)}><View className='card-row'><Text className='tag'>{item.type}</Text><Text className='status'>{item.review_status || item.status}</Text></View><Text className='title'>{item.title}</Text><Text className='summary'>{item.summary || '暂无简介'}</Text></View>)}
  </View>
}
