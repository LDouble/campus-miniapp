import { useEffect, useState } from 'react'
import Taro, { useDidShow, usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import { isApiError } from '../../api/client'
import { listLotteryCampaigns, type LotteryCampaignSummary } from '../../api/lottery'
import { useCampusShare } from '../../features/share'
import './index.scss'

const timeLabel = (value: string) => value ? value.replace('T', ' ').slice(0, 16) : '时间待公布'

const modeLabel = (mode: LotteryCampaignSummary['draw_mode']) => (
  mode === 'instant' ? '即时开奖' : '到期统一开奖'
)

const stateLabel = (item: LotteryCampaignSummary) => {
  if (item.status === 'completed') return '结果已公布'
  if (item.status === 'cancelled') return '活动已取消'
  if (new Date(item.start_at).getTime() > Date.now()) return '即将开始'
  if (new Date(item.end_at).getTime() <= Date.now()) return item.draw_mode === 'scheduled' ? '等待开奖' : '活动已结束'
  return '进行中'
}

export default function LotteryCampaignListPage() {
  const pageSize = 20
  const [items, setItems] = useState<LotteryCampaignSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)

  useCampusShare(() => ({ title: '校园抽奖活动｜OUSea', path: '/pages/lottery/index' }))

  const load = async (reset = true) => {
    if (!reset && (loadingMore || items.length >= total)) return
    if (reset) {
      setLoading(true)
      setError('')
    } else {
      setLoadingMore(true)
    }
    try {
      const result = await listLotteryCampaigns({ page: reset ? 1 : page + 1, pageSize })
      setItems((current) => reset ? result.items : [...current, ...result.items.filter((item) => !current.some((existing) => existing.id === item.id))])
      setPage(result.page)
      setTotal(result.total)
    } catch (loadError) {
      setError(isApiError(loadError) ? loadError.message : '活动加载失败，请稍后重试')
    } finally {
      setLoading(false)
      setLoadingMore(false)
      Taro.stopPullDownRefresh()
    }
  }

  useEffect(() => { void load() // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useDidShow(() => { void load() })
  usePullDownRefresh(() => { void load() })
  useReachBottom(() => { void load(false) })

  return (
    <View className='lottery-list-page'>
      <CustomNavbar title='校园抽奖' subtitle='认证参与，分享可获得额外抽奖码' showBack />
      <View className='lottery-list-page__content'>
        {loading && !items.length && <View className='lottery-state'>正在加载活动…</View>}
        {!loading && error && !items.length && (
          <View className='lottery-state lottery-state--error' onClick={() => void load()}>
            <Text>{error}</Text><Text>点击重试</Text>
          </View>
        )}
        {!loading && !error && !items.length && <View className='lottery-state'>暂时没有可查看的抽奖活动</View>}
        {items.map((item) => (
          <View
            key={item.id}
            className='lottery-campaign-card'
            ariaRole='button'
            ariaLabel={`查看${item.title}`}
            onClick={() => void Taro.navigateTo({ url: `/pages/lottery/detail?id=${item.id}` })}
          >
            {item.cover_url ? <Image className='lottery-campaign-card__cover' src={item.cover_url} mode='aspectFill' /> : <View className='lottery-campaign-card__cover lottery-campaign-card__cover--placeholder' />}
            <View className='lottery-campaign-card__body'>
              <View className='lottery-campaign-card__head'>
                <Text>{item.title}</Text>
                <Text className='lottery-campaign-card__status'>{stateLabel(item)}</Text>
              </View>
              <Text className='lottery-campaign-card__meta'>{modeLabel(item.draw_mode)} · 截止 {timeLabel(item.end_at)}</Text>
              <Text className='lottery-campaign-card__prizes'>
                {item.prizes.slice(0, 3).map((prize) => `${prize.name} ×${prize.total_quantity}`).join(' · ') || '奖品即将公布'}
              </Text>
            </View>
          </View>
        ))}
        {loadingMore && <View className='lottery-state lottery-state--more'>正在加载更多活动…</View>}
        {!loadingMore && items.length < total && <View className='lottery-load-more' onClick={() => void load(false)}>加载更多活动</View>}
      </View>
    </View>
  )
}
