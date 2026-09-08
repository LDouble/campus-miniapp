import { useEffect, useRef, useState } from 'react'
import Taro, { useDidShow, useLoad, usePullDownRefresh } from '@tarojs/taro'
import { Button, Image, Text, View } from '@tarojs/components'
import CustomNavbar from '../../components/custom-navbar'
import { createIdempotencyKey, isApiError } from '../../api/client'
import {
  createLotteryShareToken,
  drawLottery,
  getLotteryCampaign,
  listLotteryCampaignResults,
  listLotteryResults,
  participateLotteryCampaign,
  type LotteryCampaignDetail,
  type LotteryResult,
} from '../../api/lottery'
import { useCampusShare } from '../../features/share'
import {
  saveLotteryShareAttribution,
  submitStoredLotteryShareAttribution,
} from '../../features/lottery/share-attribution'
import {
  clearPendingLotteryDrawKey,
  getPendingLotteryDrawKey,
  savePendingLotteryDrawKey,
} from '../../features/lottery/draw-request'
import {
  createLotteryServerClock,
  isLotteryCampaignActive,
  lotteryRemainingLabel,
  lotteryServerNow,
  shouldClearPendingLotteryDraw,
  type LotteryServerClock,
} from '../../features/lottery/time'
import './detail.scss'

const formatTime = (value?: string | null) => value ? value.replace('T', ' ').slice(0, 16) : '待公布'
const RESULT_PAGE_SIZE = 50
const scheduledDrawing = (campaign: LotteryCampaignDetail) => (
  campaign.draw_mode === 'scheduled' && campaign.status === 'closed'
)

const errorMessage = (error: unknown) => {
  if (!isApiError(error)) return '网络暂不可用，请稍后重试'
  if (error.code === 'academic_verification_required') return '完成校园身份认证后即可参与'
  if (error.code === 'lottery_campaign_closed') return '活动已结束，无法继续参与'
  if (error.code === 'lottery_draw_idempotency_conflict') return '本次抽奖正在确认，请稍后刷新结果'
  return error.message
}

export default function LotteryCampaignDetailPage() {
  const [campaignId, setCampaignId] = useState('')
  const [campaign, setCampaign] = useState<LotteryCampaignDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [shareToken, setShareToken] = useState('')
  const [publicResults, setPublicResults] = useState<Array<{ prize_name: string; masked_user: string; masked_code: string }>>([])
  const [publicResultPage, setPublicResultPage] = useState(0)
  const [publicResultTotal, setPublicResultTotal] = useState(0)
  const [loadingMoreResults, setLoadingMoreResults] = useState(false)
  const [clock, setClock] = useState<LotteryServerClock | null>(null)
  const [, setClockTick] = useState(0)
  const [pendingDraw, setPendingDraw] = useState(false)
  const [recoveredDraw, setRecoveredDraw] = useState<LotteryResult | null>(null)
  const drawKey = useRef('')

  useLoad((options) => {
    const id = String(options.id || '')
    const sharedToken = String(options.share_token || '')
    setCampaignId(id)
    if (sharedToken) saveLotteryShareAttribution(id, sharedToken)
  })

  useCampusShare(() => ({
    title: campaign ? `${campaign.title}｜校园抽奖` : '校园抽奖活动｜OUSea',
    path: '/pages/lottery/detail',
    query: { id: campaignId, share_token: shareToken || undefined },
    imageUrl: campaign?.cover_url || undefined,
  }))

  const canShare = (detail: LotteryCampaignDetail, now: number) => (
    detail.joined
    && detail.share_enabled
    && detail.my_win_count < detail.max_wins
    && isLotteryCampaignActive(detail, now)
  )

  const refreshShareToken = async (detail: LotteryCampaignDetail, now: number) => {
    if (!canShare(detail, now)) {
      setShareToken('')
      return
    }
    try {
      const token = await createLotteryShareToken(campaignId)
      setShareToken(token.token)
    } catch {
      // 分享额度耗尽或活动状态变化不影响详情与已有抽奖结果。
      setShareToken('')
    }
  }

  const load = async () => {
    if (!campaignId) {
      setLoading(false)
      setError('活动参数无效')
      return
    }
    setLoading(true)
    setError('')
    try {
      const detail = await getLotteryCampaign(campaignId)
      setCampaign(detail)
      const nextClock = createLotteryServerClock(detail.server_time)
      setClock(nextClock)
      const now = lotteryServerNow(nextClock)
      try {
        const results = await listLotteryCampaignResults(campaignId, { page: 1, pageSize: RESULT_PAGE_SIZE })
        setPublicResults(results.items)
        setPublicResultPage(results.page)
        setPublicResultTotal(results.total)
      } catch {
        // 开奖中或网络暂时失败不影响活动本身浏览。
        setPublicResults([])
        setPublicResultPage(0)
        setPublicResultTotal(0)
      }
      const attribution = await submitStoredLotteryShareAttribution(campaignId)
      if (attribution?.rewarded_code_count) {
        Taro.showToast({ title: '已记录好友分享邀请', icon: 'none' })
      }
      const key = getPendingLotteryDrawKey(campaignId)
      if (key) {
        try {
          const drawPage = await listLotteryResults(campaignId, { requestKey: key, pageSize: 1 })
          if (drawPage.items[0]) {
            clearPendingLotteryDrawKey(campaignId)
            drawKey.current = ''
            setPendingDraw(false)
            setRecoveredDraw(drawPage.items[0])
          } else {
            drawKey.current = key
            setPendingDraw(true)
          }
        } catch {
          // 查询网络失败时继续保留 key，不能以新 key 发起另一次抽奖。
          drawKey.current = key
          setPendingDraw(true)
        }
      } else {
        drawKey.current = ''
        setPendingDraw(false)
      }
      await refreshShareToken(detail, now)
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setLoading(false)
      Taro.stopPullDownRefresh()
    }
  }

  useEffect(() => {
    if (!campaignId) return
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId])
  useEffect(() => {
    const timer = setInterval(() => setClockTick((value) => value + 1), 60_000)
    return () => clearInterval(timer)
  }, [])
  useDidShow(() => { if (campaignId) void load() })
  usePullDownRefresh(() => { void load() })

  const loadMorePublicResults = async () => {
    if (!campaignId || loadingMoreResults || publicResults.length >= publicResultTotal) return
    setLoadingMoreResults(true)
    try {
      const results = await listLotteryCampaignResults(campaignId, { page: publicResultPage + 1, pageSize: RESULT_PAGE_SIZE })
      setPublicResults((current) => [...current, ...results.items.filter((item) => !current.some((existing) => existing.masked_code === item.masked_code && existing.prize_name === item.prize_name))])
      setPublicResultPage(results.page)
      setPublicResultTotal(results.total)
    } catch {
      Taro.showToast({ title: '中奖结果加载失败，请重试', icon: 'none' })
    } finally {
      setLoadingMoreResults(false)
    }
  }

  const participate = async () => {
    if (!campaign || submitting || !clock || !isLotteryCampaignActive(campaign, lotteryServerNow(clock))) return
    setSubmitting(true)
    try {
      const detail = await participateLotteryCampaign(
        campaignId,
        createIdempotencyKey(`lottery-participation:${campaignId}`),
      )
      setCampaign(detail)
      const nextClock = createLotteryServerClock(detail.server_time)
      setClock(nextClock)
      await refreshShareToken(detail, lotteryServerNow(nextClock))
      Taro.showToast({ title: detail.draw_mode === 'scheduled' ? '已参与，抽奖码已自动入池' : '已获得 1 枚抽奖码', icon: 'none' })
    } catch (submitError) {
      // apiRequest 的认证守卫会保存当前 lottery 路由、引导认证；返回时 useDidShow 自动刷新资格状态。
      if (isApiError(submitError) && submitError.code === 'academic_verification_required') return
      Taro.showToast({ title: errorMessage(submitError), icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const draw = async () => {
    if (!campaign || submitting || campaign.draw_mode !== 'instant') return
    if (!drawKey.current) {
      drawKey.current = getPendingLotteryDrawKey(campaignId) || createIdempotencyKey(`lottery-draw:${campaignId}`)
      savePendingLotteryDrawKey(campaignId, drawKey.current)
    }
    setSubmitting(true)
    try {
      const result = await drawLottery(campaignId, drawKey.current)
      clearPendingLotteryDrawKey(campaignId)
      drawKey.current = ''
      setPendingDraw(false)
      await showDrawResult(result)
      await load()
    } catch (drawError) {
      // 保留幂等键，超时或响应丢失时重试会返回同一次抽奖的结果。
      if (isApiError(drawError) && shouldClearPendingLotteryDraw(drawError.code)) {
        clearPendingLotteryDrawKey(campaignId)
        drawKey.current = ''
        setPendingDraw(false)
      }
      Taro.showToast({ title: errorMessage(drawError), icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const showDrawResult = async (result: LotteryResult) => {
    if (result.result === 'won' && result.prize) {
      const modal = await Taro.showModal({
        title: '恭喜中奖',
        content: `你抽中了「${result.prize.name}」，请在领奖截止前完成领取。`,
        confirmText: '查看领奖详情',
        cancelText: '稍后查看',
      })
      if (modal.confirm && result.win_id) {
        await Taro.navigateTo({ url: `/pages/lottery/win/index?id=${result.win_id}` })
      }
      return
    }
    Taro.showModal({ title: '这次没有抽中', content: '抽奖码已使用。分享邀请好友可获得额外抽奖码。', showCancel: false })
  }

  const openCodes = () => void Taro.navigateTo({ url: `/pages/lottery/codes/index?campaign_id=${campaignId}` })
  const participated = !!campaign?.joined
  const serverNow = clock ? lotteryServerNow(clock) : Date.now()
  const canDraw = !!campaign && campaign.draw_mode === 'instant' && !!campaign.my_available_code_count && campaign.my_win_count < campaign.max_wins && isLotteryCampaignActive(campaign, serverNow)
  const canConfirmPendingDraw = !!campaign && campaign.draw_mode === 'instant' && pendingDraw

  return (
    <View className='lottery-detail-page'>
      <CustomNavbar title={campaign?.title || '抽奖活动'} subtitle={campaign?.draw_mode === 'instant' ? '即时开奖' : '到期统一开奖'} showBack />
      {loading && !campaign && <View className='lottery-detail-state'>正在加载活动…</View>}
      {!loading && error && !campaign && <View className='lottery-detail-state lottery-detail-state--error' onClick={() => void load()}><Text>{error}</Text><Text>点击重试</Text></View>}
      {campaign && (
        <View className='lottery-detail-page__content'>
          <View className='lottery-detail-hero'>
            {campaign.cover_url && <Image className='lottery-detail-hero__cover' src={campaign.cover_url} mode='aspectFill' />}
            <View className='lottery-detail-hero__body'>
              <Text className='lottery-detail-hero__mode'>{campaign.draw_mode === 'instant' ? '即时随机开奖' : '到期统一开奖'}</Text>
              <Text className='lottery-detail-hero__title'>{campaign.title}</Text>
              <Text className='lottery-detail-hero__time'>{scheduledDrawing(campaign) ? '开奖中，结果将在完成后统一公布' : `${lotteryRemainingLabel(campaign.end_at, serverNow)} · ${formatTime(campaign.end_at)} 截止`}</Text>
            </View>
          </View>

          <View className='lottery-detail-mine'>
            <View><Text>我的抽奖码</Text><Text>{campaign.my_code_count} 枚</Text></View>
            <View><Text>{campaign.draw_mode === 'instant' ? '可抽次数' : '已自动入池'}</Text><Text>{campaign.draw_mode === 'instant' ? campaign.my_available_code_count : campaign.my_code_count}</Text></View>
            <View className='lottery-detail-mine__link' ariaRole='button' ariaLabel='查看我的抽奖码' onClick={openCodes}>查看</View>
          </View>

          <View className='lottery-detail-section'>
            <Text className='lottery-detail-section__title'>奖品</Text>
            {campaign.prizes.map((prize) => (
              <View key={prize.id} className='lottery-prize-row'>
                {prize.image_url ? <Image src={prize.image_url} mode='aspectFill' /> : <View className='lottery-prize-row__image' />}
                <View><Text>{prize.name}</Text><Text>{prize.description || '活动奖品'}{campaign.draw_mode === 'instant' ? ` · 概率 ${(prize.instant_probability_bps / 100).toFixed(2)}%` : ` · 第 ${prize.scheduled_draw_order} 顺位开奖`}</Text></View>
                <Text>共 {prize.total_quantity} 份</Text>
              </View>
            ))}
          </View>

          {!!publicResults.length && (
            <View className='lottery-detail-section'>
              <Text className='lottery-detail-section__title'>中奖结果</Text>
              {publicResults.map((item, index) => <View className='lottery-result-row' key={`${item.masked_code}-${index}`}><Text>{item.prize_name}</Text><Text>{item.masked_user} · {item.masked_code}</Text></View>)}
              {loadingMoreResults && <View className='lottery-result-more'>正在加载更多中奖结果…</View>}
              {!loadingMoreResults && publicResults.length < publicResultTotal && <View className='lottery-result-more' onClick={() => void loadMorePublicResults()}>加载更多中奖结果</View>}
            </View>
          )}

          <View className='lottery-detail-section'>
            <Text className='lottery-detail-section__title'>活动规则</Text>
            <Text className='lottery-detail-section__copy'>认证用户每场首次参与可获得 1 枚基础抽奖码；每人每场最多中奖 {campaign.max_wins} 份。</Text>
            <Text className='lottery-detail-section__copy'>{campaign.draw_mode === 'instant' ? '每次抽奖使用 1 枚码，未中奖同样会消耗；奖品发完后不再中奖。' : '活动截止后统一开奖，所有已获得的码会自动入池；结果公布前不展示部分中奖名单。'}</Text>
            <Text className='lottery-detail-section__copy'>{campaign.description}</Text>
          </View>

          {campaign.my_win_count ? <View className='lottery-detail-win-link' ariaRole='button' ariaLabel='查看我的中奖结果' onClick={() => openCodes()}>查看我的中奖与领奖信息</View> : null}
          <View className='lottery-detail-actions'>
            {!participated && <Button className='lottery-primary-button' disabled={submitting || !isLotteryCampaignActive(campaign, serverNow)} loading={submitting} onClick={() => void participate()}>{isLotteryCampaignActive(campaign, serverNow) ? '认证后参与抽奖' : '活动暂不可参与'}</Button>}
            {participated && campaign.draw_mode === 'instant' && <Button className='lottery-primary-button' disabled={submitting || (!canDraw && !canConfirmPendingDraw)} loading={submitting} onClick={() => void draw()}>{canConfirmPendingDraw ? '确认上次抽奖结果' : canDraw ? `抽一次（剩余 ${campaign.my_available_code_count} 次）` : '暂无可用抽奖码'}</Button>}
            {participated && campaign.draw_mode === 'scheduled' && <View className='lottery-scheduled-copy'>{scheduledDrawing(campaign) ? '开奖中，所有结果完成后将一次性公布' : `已参与 · 共 ${campaign.my_code_count} 枚码，等待活动截止后统一开奖`}</View>}
            {recoveredDraw && <View className='lottery-draw-recovery' onClick={() => void showDrawResult(recoveredDraw)}>{recoveredDraw.result === 'won' ? `上次抽奖已恢复：${recoveredDraw.prize?.name || '已中奖'}` : '上次抽奖已恢复：未中奖'}<Text>查看结果</Text></View>}
            {participated && canShare(campaign, serverNow) && <><Button className='lottery-share-button' openType='share' disabled={!shareToken}>邀请好友，获得额外抽奖码</Button><Text className='lottery-share-hint'>{campaign.share_new_user_only ? `仅通过本链接完成首次注册的好友可计入奖励，每次 ${campaign.share_reward_code_count} 枚，每日最多 ${campaign.share_daily_code_limit} 枚、活动累计最多 ${campaign.share_total_code_limit} 枚。` : `好友完成登录后可计入奖励，每次 ${campaign.share_reward_code_count} 枚，每日最多 ${campaign.share_daily_code_limit} 枚、活动累计最多 ${campaign.share_total_code_limit} 枚；同一好友仅首次归因有效。`}</Text></>}
          </View>
        </View>
      )}
    </View>
  )
}
