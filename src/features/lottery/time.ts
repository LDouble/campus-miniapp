import type { LotteryCampaignDetail } from '../../api/lottery'

export type LotteryServerClock = { serverNow: number; receivedAt: number }

export const createLotteryServerClock = (serverTime: string, receivedAt = Date.now()): LotteryServerClock => ({
  serverNow: new Date(serverTime).getTime(),
  receivedAt,
})

export const lotteryServerNow = (clock: LotteryServerClock, now = Date.now()) => (
  clock.serverNow + Math.max(0, now - clock.receivedAt)
)

export const isLotteryCampaignActive = (
  campaign: LotteryCampaignDetail,
  now: number,
) => campaign.status === 'published'
  && new Date(campaign.start_at).getTime() <= now
  && new Date(campaign.end_at).getTime() > now

export const lotteryRemainingLabel = (endAt: string, now: number) => {
  const remaining = new Date(endAt).getTime() - now
  if (remaining <= 0) return '活动已结束'
  const minutes = Math.floor(remaining / 60_000)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  if (days) return `${days} 天 ${hours} 小时后截止`
  if (hours) return `${hours} 小时 ${minutes % 60} 分后截止`
  return `${minutes} 分后截止`
}

// 仅清理领域层明确拒绝的请求。幂等中间件冲突和未知错误可能意味着
// 服务端已完成抽奖但响应丢失，必须保留同一 request key 供查询/重试。
export const shouldClearPendingLotteryDraw = (code?: string) => code === 'lottery_conflict'
