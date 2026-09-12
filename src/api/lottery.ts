import { apiRequest, createIdempotencyKey } from './client'

export type LotteryDrawMode = 'scheduled' | 'instant'
export type LotteryCampaignStatus = 'draft' | 'published' | 'closed' | 'completed' | 'cancelled'
export type LotteryCodeStatus = 'available' | 'entered' | 'won' | 'lost' | 'excluded' | 'expired' | 'void'
export type LotteryClaimStatus = 'pending' | 'fulfilled' | 'expired'

export type LotteryPrize = {
  id: number
  name: string
  image_url?: string | null
  description?: string | null
  total_quantity: number
  allocated_quantity: number
  instant_probability_bps: number
  scheduled_draw_order: number
  claim_method?: string | null
  claim_deadline_at?: string | null
}

export type LotterySponsor = {
  name: string
  description: string
  wechat_id: string
  image_url?: string | null
  display_order: number
}

export type LotteryCampaignSummary = {
  id: number
  title: string
  cover_url?: string | null
  draw_mode: LotteryDrawMode
  status: LotteryCampaignStatus
  start_at: string
  end_at: string
  prizes: LotteryPrize[]
}

export type LotteryCode = {
  id: number
  code: string
  source: string
  status: LotteryCodeStatus
  created_at: string
  exclusion_reason?: string | null
}

export type LotteryResult = {
  id: number
  code_id: number
  code?: string | null
  result: 'won' | 'lost'
  drawn_at: string
  prize?: LotteryPrize | null
  win_id?: number | null
}

export type LotteryWin = {
  id: number
  campaign_id: number
  campaign_title: string
  code_id: number
  code: string
  prize: LotteryPrize
  status: LotteryClaimStatus
  fulfillment_note?: string | null
  created_at: string
}

export type LotteryCampaignDetail = LotteryCampaignSummary & {
  description: string
  // 服务端已按 display_order 升序返回；客户端保持原顺序展示。
  sponsors?: LotterySponsor[]
  max_wins: number
  share_enabled: boolean
  share_new_user_only: boolean
  share_reward_code_count: number
  share_daily_code_limit: number
  share_total_code_limit: number
  server_time: string
  joined: boolean
  verified: boolean
  my_code_count: number
  my_available_code_count: number
  my_win_count: number
}

const lotteryPath = (campaignId: number | string, suffix = '') => (
  `/api/v1/lottery/campaigns/${encodeURIComponent(String(campaignId))}${suffix}`
)

export const getLotteryCampaign = (campaignId: number | string) => apiRequest<LotteryCampaignDetail>({
  path: lotteryPath(campaignId),
})

export const participateLotteryCampaign = (campaignId: number | string, idempotencyKey: string) => (
  apiRequest<LotteryCampaignDetail>({
    path: lotteryPath(campaignId, '/participations'),
    method: 'POST',
    idempotencyKey,
  })
)

type LotteryPage<T> = { items: T[]; page: number; page_size: number; total: number }
type LotteryPageOptions = { page?: number; pageSize?: number; requestKey?: string }

export const listLotteryCampaigns = (options: LotteryPageOptions = {}) => apiRequest<LotteryPage<LotteryCampaignSummary>>({
  path: '/api/v1/lottery/campaigns',
  query: { page: options.page, page_size: options.pageSize },
})

export const listLotteryCodes = (campaignId: number | string, options: LotteryPageOptions = {}) => apiRequest<LotteryPage<LotteryCode>>({
  path: lotteryPath(campaignId, '/codes'),
  query: { page: options.page, page_size: options.pageSize },
})

export const drawLottery = (campaignId: number | string, idempotencyKey: string) => apiRequest<LotteryResult>({
  path: lotteryPath(campaignId, '/draws'),
  method: 'POST',
  idempotencyKey,
})

export const listLotteryResults = (campaignId: number | string, options: LotteryPageOptions = {}) => apiRequest<LotteryPage<LotteryResult>>({
  path: lotteryPath(campaignId, '/draws'),
  query: { page: options.page, page_size: options.pageSize, request_key: options.requestKey },
})

export const listLotteryCampaignResults = (campaignId: number | string, options: LotteryPageOptions = {}) => apiRequest<LotteryPage<{
  prize_name: string
  masked_user: string
  masked_code: string
}>>({
  path: lotteryPath(campaignId, '/results'),
  query: { page: options.page, page_size: options.pageSize },
})

export const getLotteryWin = (winId: number | string) => apiRequest<LotteryWin>({
  path: `/api/v1/lottery/wins/${encodeURIComponent(String(winId))}`,
})

export const createLotteryShareToken = (campaignId: number | string) => apiRequest<{
  token: string
  expires_at: string
}>({
  path: lotteryPath(campaignId, '/share-tokens'),
  method: 'POST',
  idempotencyKey: createIdempotencyKey(`lottery-share-token:${campaignId}`),
})

export const submitLotteryShareAttribution = (
  campaignId: number | string,
  shareToken: string,
) => apiRequest<{ status: string; rewarded_code_count: number; reason?: string | null }>({
  path: lotteryPath(campaignId, '/share-attributions'),
  method: 'POST',
  data: { token: shareToken },
  idempotencyKey: createIdempotencyKey(`lottery-share-attribution:${campaignId}`),
})
