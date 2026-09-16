import type { LotteryCampaignSummary } from '../../api/lottery'

export const lotteryShareCard = (campaign: LotteryCampaignSummary, now: number) => {
  const ended = ['closed', 'completed', 'cancelled'].includes(campaign.status) || Date.parse(campaign.end_at) <= now
  const upcoming = !ended && Date.parse(campaign.start_at) > now
  const status = ended ? '活动已结束' : upcoming ? '活动即将开始' : campaign.draw_mode === 'instant' ? '即时随机开奖' : '到期统一开奖'
  return {
    title: `${ended ? '校园抽奖结果' : upcoming ? '校园抽奖预告' : '邀你参与校园抽奖'}｜${campaign.title}`,
    heading: campaign.title,
    status,
    prize: campaign.prizes[0]?.name || '校园惊喜好礼',
    image: campaign.prizes[0]?.image_url || campaign.cover_url || '',
    quantities: `${campaign.prizes.length} 种奖品 · 共 ${campaign.prizes.reduce((sum, prize) => sum + prize.total_quantity, 0)} 份`,
    footer: ended ? '查看活动与中奖结果' : upcoming ? '提前了解活动规则' : '校园认证用户可参与',
  }
}
