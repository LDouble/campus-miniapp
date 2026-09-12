import { useEffect, useRef, useState } from 'react'
import Taro, { useDidShow, useLoad, usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import CustomNavbar from '../../../components/custom-navbar'
import { isApiError } from '../../../api/client'
import { listLotteryCodes, listLotteryResults, type LotteryCode, type LotteryResult } from '../../../api/lottery'
import './index.scss'

const statusCopy: Record<LotteryCode['status'], string> = { available: '待抽奖', entered: '已入池', won: '已中奖', lost: '未中奖', excluded: '已排除', expired: '已过期', void: '已作废' }
const time = (value: string) => value.replace('T', ' ').slice(0, 16)
const PAGE_SIZE = 50

const mergeById = <T extends { id: number }>(current: T[], next: T[]) => {
  const merged = new Map(current.map((item) => [item.id, item]))
  next.forEach((item) => merged.set(item.id, item))
  return [...merged.values()]
}

export default function LotteryCodesPage() {
  const [campaignId, setCampaignId] = useState('')
  const [codes, setCodes] = useState<LotteryCode[]>([])
  const [results, setResults] = useState<LotteryResult[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [codePage, setCodePage] = useState(0)
  const [drawPage, setDrawPage] = useState(0)
  const [codeTotal, setCodeTotal] = useState(0)
  const [drawTotal, setDrawTotal] = useState(0)
  const loadingMoreRef = useRef(false)
  useLoad((options) => setCampaignId(String(options.campaign_id || '')))
  const load = async (reset = true) => {
    if (!campaignId) return
    const nextCodePage = reset ? 1 : codePage + 1
    const nextDrawPage = reset ? 1 : drawPage + 1
    if (!reset && loadingMoreRef.current) return
    if (!reset && codePage * PAGE_SIZE >= codeTotal && drawPage * PAGE_SIZE >= drawTotal) return
    if (reset) { setLoading(true); setError('') } else { loadingMoreRef.current = true; setLoadingMore(true) }
    try {
      const [codeData, resultData] = await Promise.all([
        codePage * PAGE_SIZE < codeTotal || reset ? listLotteryCodes(campaignId, { page: nextCodePage, pageSize: PAGE_SIZE }) : null,
        drawPage * PAGE_SIZE < drawTotal || reset ? listLotteryResults(campaignId, { page: nextDrawPage, pageSize: PAGE_SIZE }) : null,
      ])
      if (codeData) {
        setCodes((current) => reset ? codeData.items : mergeById(current, codeData.items))
        setCodePage(codeData.page); setCodeTotal(codeData.total)
      }
      if (resultData) {
        setResults((current) => reset ? resultData.items : mergeById(current, resultData.items))
        setDrawPage(resultData.page); setDrawTotal(resultData.total)
      }
    } catch (loadError) { setError(isApiError(loadError) ? loadError.message : '抽奖码加载失败') }
    finally { setLoading(false); loadingMoreRef.current = false; setLoadingMore(false); Taro.stopPullDownRefresh() }
  }
  useEffect(() => { if (campaignId) void load(true) // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId])
  useDidShow(() => { if (campaignId) void load(true) }); usePullDownRefresh(() => { void load(true) }); useReachBottom(() => { void load(false) })
  return <View className='lottery-codes-page'>
    <CustomNavbar title='我的抽奖码' subtitle='抽奖码不可转让或跨活动使用' showBack />
    <View className='lottery-codes-page__content'>
      {loading && <View className='lottery-codes-state'>正在加载抽奖码…</View>}
      {!loading && error && <View className='lottery-codes-state lottery-codes-state--error' onClick={() => void load()}>{error}，点击重试</View>}
      {!loading && !error && !codes.length && <View className='lottery-codes-state'>暂时还没有抽奖码</View>}
      {!loading && !error && codes.map((code) => <View key={code.id} className='lottery-code-card'>
        <View className='lottery-code-card__head'><Text>{statusCopy[code.status]}</Text><Text>{code.source.toLowerCase() === 'base' ? '基础码' : '分享奖励码'}</Text></View>
        <Text className='lottery-code-card__value'>{code.code}</Text>
        <Text className='lottery-code-card__time'>发放于 {time(code.created_at)}{code.exclusion_reason ? ` · ${code.exclusion_reason}` : ''}</Text>
      </View>)}
      {!loading && results.filter((result) => result.result === 'won').map((result) => (
        <View
          key={result.id}
          className='lottery-codes-win'
          ariaRole='button'
          ariaLabel={`查看${result.prize?.name || '中奖奖品'}领奖详情`}
          onClick={() => result.win_id && void Taro.navigateTo({ url: `/pages/lottery/win/index?id=${result.win_id}` })}
        >
          <Text>中奖：{result.prize?.name || '奖品'}</Text><Text>查看领奖详情 ›</Text>
        </View>
      ))}
      {loadingMore && <View className='lottery-codes-state lottery-codes-state--more'>正在加载更多记录…</View>}
      {!loadingMore && (codes.length < codeTotal || results.length < drawTotal) && <View className='lottery-codes-load-more' onClick={() => void load(false)}>加载更多</View>}
    </View>
  </View>
}
