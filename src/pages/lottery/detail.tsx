import { useEffect, useRef, useState } from 'react'
import Taro, { useDidShow, useLoad, usePullDownRefresh } from '@tarojs/taro'
import { Button, Canvas, Image, OfficialAccount, Text, View } from '@tarojs/components'
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
import giftImage from '../../assets/lottery/gift-3750.png'
import shareIcon from '../../assets/lottery/share.svg'
import drawIcon from '../../assets/lottery/draw-3750.svg'
import broadcastIcon from '../../assets/lottery/broadcast-3750.svg'
import chevronIcon from '../../assets/lottery/chevron-3750.svg'
import clockIcon from '../../assets/lottery/clock-3750.svg'
import copyIcon from '../../assets/lottery/copy-3750.svg'
import plusIcon from '../../assets/lottery/plus-3750.svg'
import { lotteryShareCard } from '../../features/lottery/share-card'
import { LOTTERY_SHARE_CANVAS, renderLotteryShareCard } from '../../features/lottery/share-card-image'

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
  const [rulesExpanded, setRulesExpanded] = useState(true)
  const [resultsExpanded, setResultsExpanded] = useState(false)
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({})
  const [officialAccountUnavailable, setOfficialAccountUnavailable] = useState(false)
  const [shareCardImage, setShareCardImage] = useState<{ key: string; path: string } | null>(null)
  const shareRenderQueue = useRef<Promise<void>>(Promise.resolve())
  const shareCard = campaign ? lotteryShareCard(campaign, clock ? lotteryServerNow(clock) : Date.now()) : null
  const shareCardKey = shareCard ? JSON.stringify(shareCard) : ''

  useEffect(() => {
    if (!shareCardKey) return
    let cancelled = false
    // 同一画布串行绘制，刷新详情时不让旧活动的导出覆盖新卡片。
    shareRenderQueue.current = shareRenderQueue.current.then(async () => {
      if (cancelled) return
      try {
        await new Promise<void>(resolve => Taro.nextTick(resolve))
        const path = await renderLotteryShareCard(JSON.parse(shareCardKey))
        if (!cancelled) setShareCardImage({ key: shareCardKey, path })
      } catch {
        // 图片未准备好或导出失败时，分享仍可立即使用包内礼盒图。
      }
    })
    return () => { cancelled = true }
  }, [shareCardKey])

  useLoad((options) => {
    const id = String(options.id || '')
    const sharedToken = String(options.share_token || '')
    setCampaignId(id)
    if (sharedToken) saveLotteryShareAttribution(id, sharedToken)
  })

  useCampusShare(() => ({
    title: shareCard?.title || '校园抽奖活动｜OUSea',
    path: '/pages/lottery/detail',
    query: { id: campaignId, share_token: shareToken || undefined },
    imageUrl: shareCardImage?.key === shareCardKey ? shareCardImage.path : giftImage,
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
    const timer = setInterval(() => setClockTick((value) => value + 1), 1000)
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
  const copyWechatId = async (wechatId: string, subject: string) => {
    try {
      await Taro.setClipboardData({ data: wechatId })
      await Taro.showToast({ title: `${subject}微信号已复制`, icon: 'none' })
    } catch {
      await Taro.showToast({ title: '复制失败，请重试', icon: 'none' })
    }
  }
  const participated = !!campaign?.joined
  const serverNow = clock ? lotteryServerNow(clock) : Date.now()
  const canDraw = !!campaign && campaign.draw_mode === 'instant' && !!campaign.my_available_code_count && campaign.my_win_count < campaign.max_wins && isLotteryCampaignActive(campaign, serverNow)
  const canConfirmPendingDraw = !!campaign && campaign.draw_mode === 'instant' && pendingDraw

  const remainingSeconds = Math.max(0, Math.floor((Date.parse(campaign?.end_at || '') - serverNow) / 1000)) || 0
  const countdown = [Math.floor(remainingSeconds / 3600), Math.floor(remainingSeconds / 60) % 60, remainingSeconds % 60].map(value => String(value).padStart(2, '0'))
  const shareAllowed = !!campaign && canShare(campaign, serverNow)

  return (
    <View className='lottery-detail-page'>
      <Canvas canvasId={LOTTERY_SHARE_CANVAS} style={{ position: 'fixed', left: '-10000px', top: '0', width: '500px', height: '400px', pointerEvents: 'none' }} />
      <CustomNavbar title='幸运大抽奖' showBack />
      {campaign && !!publicResults.length && <View className='lottery-broadcast' ariaRole='button' ariaLabel='查看中奖名单' onClick={() => setResultsExpanded(value => !value)}><Image className='lottery-asset' src={broadcastIcon} /><Text>恭喜 {publicResults[0].masked_user} 抽中 {publicResults[0].prize_name}</Text></View>}
      {loading && !campaign && <View className='lottery-detail-state'>正在加载活动…</View>}
      {!loading && error && !campaign && <View className='lottery-detail-state lottery-detail-state--error' onClick={() => void load()}><Text>{error}</Text><Text>点击重试</Text></View>}
      {campaign && (
        <View className='lottery-detail-page__content'>
          <View className='lottery-guarantees'>
            <Text>{campaign.draw_mode === 'instant' ? '即时随机开奖' : '到期统一开奖'}</Text>
            <Text>校园认证参与</Text>
            <Text>中奖结果可查</Text>
          </View>
          <View className='lottery-detail-hero'>
            <View className='lottery-detail-hero__body'>
              <Text className='lottery-detail-hero__mode'>限时专场 · 活动 {campaign.id}</Text>
              <Text className='lottery-detail-hero__title'>{campaign.title}</Text>
              <Text className='lottery-detail-hero__description'>认证参与，收获一份校园惊喜</Text>
              <View className='lottery-detail-hero__countdown'>
                <View className='lottery-countdown-label'><Image className='lottery-asset' src={clockIcon} />{scheduledDrawing(campaign) ? '开奖中，结果待公布' : isLotteryCampaignActive(campaign, serverNow) ? '距离本轮开奖收官' : lotteryRemainingLabel(campaign.end_at, serverNow)}</View>
                {isLotteryCampaignActive(campaign, serverNow) && <View className='lottery-countdown-digits'>{countdown.map((part, index) => <View className='lottery-countdown-part' key={index}>{index > 0 && <Text className='lottery-countdown-separator'>:</Text>}<Text className='lottery-countdown-value'>{part}</Text></View>)}</View>}
              </View>
            </View>
          </View>

          <View className='lottery-detail-mine'>
            <View className='lottery-mine-grid'>
              <View className='lottery-mine-stat' ariaRole='button' ariaLabel='查看我的抽奖码' onClick={openCodes}>
                <View className='lottery-mine-label'><Text>我的抽奖码</Text><Text className='lottery-mine-badge'>{participated ? '已参与' : '待参与'}</Text></View>
                <View className='lottery-mine-number'>{campaign.my_code_count}<Text>枚</Text></View>
                <Text className='lottery-mine-caption'>查看抽奖码与中奖记录</Text>
              </View>
              <View className='lottery-mine-stat'>
                <View className='lottery-mine-label'><Text>{campaign.draw_mode === 'instant' ? '剩余抽奖资格' : '已自动入池'}</Text></View>
                <View className='lottery-mine-number lottery-mine-number--accent'>{campaign.draw_mode === 'instant' ? campaign.my_available_code_count : campaign.my_code_count}<Text>{campaign.draw_mode === 'instant' ? '次' : '枚'}</Text></View>
                <Text className='lottery-mine-caption'>每人最多中奖 {campaign.max_wins} 份</Text>
              </View>
            </View>
            {shareAllowed && <Button className='lottery-invite-strip' hoverClass='none' openType='share' disabled={!shareToken}><Text>每邀请 1 位有效好友，获得 {campaign.share_reward_code_count} 枚抽奖码</Text><Text>去获取</Text></Button>}
          </View>

          <View className='lottery-prizes-heading'>
            <Text className='lottery-prizes-heading__title'>本期奖品池</Text>
            <View className='lottery-prizes-heading__link' ariaRole='button' onClick={() => setResultsExpanded(value => !value)}>中奖名单 ›</View>
          </View>
          <View className={`lottery-prize-grid${campaign.prizes.length === 1 ? ' lottery-prize-grid--single' : ''}`}>
            {campaign.prizes.map((prize) => (
              <View key={prize.id} className='lottery-prize-card'>
                <Text className='lottery-prize-card__badge'>共 {prize.total_quantity} 份</Text>
                <View className='lottery-prize-card__media'><Image className={`lottery-prize-card__image${!prize.image_url || failedImages[prize.id] ? ' lottery-prize-card__image--placeholder' : ''}`} src={failedImages[prize.id] ? giftImage : prize.image_url || giftImage} mode={prize.image_url && !failedImages[prize.id] ? 'aspectFill' : 'aspectFit'} onError={() => setFailedImages(current => ({ ...current, [prize.id]: true }))} /></View>
                <Text className='lottery-prize-card__name'>{prize.name}</Text>
                <Text className='lottery-prize-card__description'>{prize.description || '奖品详情以活动规则为准'}</Text>
              </View>
            ))}
          </View>

          {resultsExpanded && <View className='lottery-detail-section'>
            <Text className='lottery-detail-section__title'>中奖结果</Text>
            {!publicResults.length && <Text className='lottery-detail-section__copy'>{scheduledDrawing(campaign) ? '开奖中，结果完成后统一公布' : '暂无已公布的中奖结果'}</Text>}
            {publicResults.map((item, index) => <View className='lottery-result-row' key={`${item.masked_code}-${index}`}><Text>{item.prize_name}</Text><Text>{item.masked_user} · {item.masked_code}</Text></View>)}
            {loadingMoreResults && <View className='lottery-result-more'>正在加载更多中奖结果…</View>}
            {!loadingMoreResults && publicResults.length < publicResultTotal && <View className='lottery-result-more' onClick={() => void loadMorePublicResults()}>加载更多中奖结果</View>}
          </View>}

          {!!campaign.sponsors?.length && <View className='lottery-detail-section lottery-sponsors'>
            <View className='lottery-sponsors__heading'><Text className='lottery-detail-section__title'>活动赞助商</Text><Text className='lottery-sponsors__subtitle'>校园特约合作</Text></View>
            {campaign.sponsors.map((sponsor) => (
              <View key={`${sponsor.display_order}-${sponsor.name}`} className='lottery-sponsor-card'>
                {sponsor.image_url && <Image className='lottery-sponsor-card__image' src={sponsor.image_url} mode='aspectFill' />}
                <View className='lottery-sponsor-card__body'>
                  <View className='lottery-sponsor-card__header'><Text className='lottery-sponsor-card__name'>{sponsor.name}</Text><Button className='lottery-sponsor-card__copy' hoverClass='none' ariaLabel={`复制${sponsor.name}微信号`} onClick={() => void copyWechatId(sponsor.wechat_id, sponsor.name)}><Image className='lottery-asset' src={plusIcon} />加微咨询</Button></View>
                  <Text className='lottery-sponsor-card__description'>{sponsor.description}</Text>
                </View>
              </View>
            ))}
          </View>}

          <View className='lottery-detail-section lottery-official-account'>
            <Text className='lottery-detail-section__title'>关注 WeOUC 公众号</Text>
            {!officialAccountUnavailable && <View className='lottery-official-account__native'>
              <OfficialAccount onError={() => setOfficialAccountUnavailable(true)} />
            </View>}
            <Text className='lottery-detail-section__copy'>
              {officialAccountUnavailable
                ? '当前进入场景暂不支持快捷关注，请在微信搜索并关注 WeOUC。'
                : '可通过上方组件关注；若组件未显示，请在微信搜索并关注 WeOUC。'}
            </Text>
            <Button className='lottery-official-account__copy' hoverClass='none' onClick={() => void copyWechatId('WeOUC', 'WeOUC')}><Image className='lottery-asset' src={copyIcon} />复制 WeOUC 搜索</Button>
          </View>

          <View className='lottery-detail-section'>
            <Button className='lottery-rules-toggle' hoverClass='none' onClick={() => setRulesExpanded(value => !value)}>抽奖规则说明<Image className='lottery-asset' src={chevronIcon} style={{ transform: rulesExpanded ? 'none' : 'rotate(180deg)' }} /></Button>
            {rulesExpanded && <>
              <Text className='lottery-detail-section__copy'>1. 认证用户每场首次参与可获得 1 枚基础抽奖码；每人每场最多中奖 {campaign.max_wins} 份。</Text>
              <Text className='lottery-detail-section__copy'>2. {campaign.draw_mode === 'instant' ? '每次抽奖使用 1 枚码，未中奖同样会消耗；奖品发完后不再中奖，不保证每次中奖。' : '活动截止后统一开奖，所有已获得的码自动入池；结果公布前不展示部分中奖名单。'}</Text>
              <Text className='lottery-detail-section__copy'>3. 活动截止：{formatTime(campaign.end_at)}。领奖方式及期限以中奖详情为准。</Text>
              {campaign.share_enabled && <Text className='lottery-share-hint'>{campaign.share_new_user_only ? '仅通过分享链接完成首次注册的好友可计入奖励。' : '好友完成登录后可计入奖励；同一好友仅首次归因有效。'}每次 {campaign.share_reward_code_count} 枚，每日最多 {campaign.share_daily_code_limit} 枚、活动累计最多 {campaign.share_total_code_limit} 枚。</Text>}
              <View className='lottery-prize-odds'>{campaign.prizes.map(prize => <Text className='lottery-detail-section__copy' key={prize.id}>{prize.name}：{campaign.draw_mode === 'instant' ? `概率 ${(prize.instant_probability_bps / 100).toFixed(2)}%` : `第 ${prize.scheduled_draw_order} 顺位`}，剩余 {Math.max(0, prize.total_quantity - prize.allocated_quantity)} 份</Text>)}</View>
              {!!campaign.description && <Text className='lottery-detail-section__copy lottery-rules-description'>{campaign.description}</Text>}
            </>}
          </View>
          {campaign.my_win_count ? <View className='lottery-detail-win-link' ariaRole='button' ariaLabel='查看我的中奖结果' onClick={openCodes}>查看我的中奖与领奖信息</View> : null}
          {recoveredDraw && <View className='lottery-draw-recovery' onClick={() => void showDrawResult(recoveredDraw)}>{recoveredDraw.result === 'won' ? `上次抽奖已恢复：${recoveredDraw.prize?.name || '已中奖'}` : '上次抽奖已恢复：未中奖'}<Text>查看结果</Text></View>}
          <View className='lottery-detail-actions'>
            <View className='lottery-action-row'>
              {shareAllowed && <Button className='lottery-share-button' hoverClass='none' openType='share' disabled={!shareToken}><Image className='lottery-asset' src={shareIcon} />邀好友得次数</Button>}
              {!participated && <Button className='lottery-primary-button' hoverClass='none' disabled={submitting || !isLotteryCampaignActive(campaign, serverNow)} loading={submitting} onClick={() => void participate()}>{isLotteryCampaignActive(campaign, serverNow) ? campaign.verified ? '立即参与抽奖' : '认证后参与抽奖' : '活动暂不可参与'}</Button>}
              {participated && campaign.draw_mode === 'instant' && <Button className='lottery-primary-button' hoverClass='none' disabled={submitting || (!canDraw && !canConfirmPendingDraw)} loading={submitting} onClick={() => void draw()}><Image className='lottery-asset' src={drawIcon} />{canConfirmPendingDraw ? '确认上次结果' : canDraw ? `立即开奖 (剩余${campaign.my_available_code_count}次)` : '暂无可用抽奖码'}</Button>}
              {participated && campaign.draw_mode === 'scheduled' && <View className='lottery-scheduled-copy'>{scheduledDrawing(campaign) ? '开奖中，结果完成后统一公布' : `已参与 · ${campaign.my_code_count} 枚码已入池`}</View>}
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
