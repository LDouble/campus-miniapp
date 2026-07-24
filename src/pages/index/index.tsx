import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useState } from 'react'
import { FeedItem, getAcademicStatus, getFeed, login } from '../../services/api'
import { FeatureGrid } from '../../components/FeatureGrid'
import { FeedCard } from '../../components/FeedCard'
import { DesignIcon } from '../../components/DesignIcon'
import { useNavigationMetrics } from '../../hooks/useNavigationMetrics'
import { syncCustomTabBar } from '../../utils/tabbar'
import './index.scss'

export default function Index () {
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { topInset } = useNavigationMetrics()
  const load = async () => {
    setLoading(true); setError('')
    try { setItems(await getFeed()) } catch (e) { setError((e as Error).message) } finally { setLoading(false); Taro.stopPullDownRefresh() }
  }
  useDidShow(() => { syncCustomTabBar(0); void load() })
  usePullDownRefresh(() => { void load() })
  const ensureLogin = async () => { try { await login(); await load() } catch (e) { setError((e as Error).message) } }
  const verify = async () => { try { const status = await getAcademicStatus(); if (status.identity) Taro.showToast({ title: '已完成认证', icon: 'none' }); else Taro.navigateTo({ url: '/pages/verify/index' }) } catch (_) { Taro.navigateTo({ url: '/pages/verify/index' }) } }
  const featureClick = (name: string) => {
    if (name === '我的课表' || name === '查成绩' || name === '通过率' || name === '考试安排') { Taro.showToast({ title: `${name}即将开放`, icon: 'none' }); return }
    if (name === '二手市场') { Taro.navigateTo({ url: '/pages/community/index?topic=闲置' }); return }
    if (name === '校园跑腿') { Taro.navigateTo({ url: '/pages/community/index?topic=跑腿' }); return }
    if (name === '失物招领') { Taro.navigateTo({ url: '/pages/community/index?topic=失物招领' }); return }
    Taro.showToast({ title: `${name}即将开放`, icon: 'none' })
  }
  return <View className='page-shell'>
    <View className='page-glow' />
    <View className='home-header' style={{ paddingTop: `${topInset + 8}px` }}><View><Text className='greeting'>早上好，同学</Text><View className='school-line'><Text className='school-name'>校园生活</Text><View className='weather'><DesignIcon name='canteen' /><Text>24°</Text></View></View></View><View className='bell'><DesignIcon name='bell' /><View className='notice-dot' /></View></View>
    <View className='home-scroll'>
      <View className='glass-banner'><View className='banner-shine' /><View className='banner-pill'><DesignIcon name='grade' /><Text>新生专区</Text></View><Text className='banner-title'>2026 秋季报到指南</Text><Text className='banner-subtitle'>提前了解校园，开学不迷路</Text><View className='banner-action'><Text>立即查看</Text><DesignIcon name='arrow' /></View></View>
      <FeatureGrid onClick={featureClick} />
      <View className='section-heading'><Text>最新动态</Text><Text className='section-more' onClick={() => Taro.navigateTo({ url: '/pages/community/index' })}>查看更多 ›</Text></View>
      {loading && <Text className='hint'>正在加载内容…</Text>}
      {!loading && error && <View className='empty'><Text>{error}</Text><Button size='mini' onClick={ensureLogin}>微信登录并重试</Button></View>}
      {!loading && !error && items.length === 0 && <View className='empty'><Text>暂时没有公开内容</Text><Button size='mini' onClick={ensureLogin}>登录后刷新</Button></View>}
      <View className='feed-list'>{items.slice(0, 5).map(item => <FeedCard item={item} key={`${item.type}-${item.id}`} />)}</View>
      <View className='verify-shortcut' onClick={verify}><View><Text className='shortcut-title'>完成教务认证</Text><Text className='shortcut-subtitle'>解锁完整校园服务</Text></View><Text className='shortcut-arrow'>›</Text></View>
    </View>
  </View>
}
