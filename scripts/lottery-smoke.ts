import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  createLotteryServerClock,
  isLotteryCampaignActive,
  lotteryRemainingLabel,
  lotteryServerNow,
  shouldClearPendingLotteryDraw,
} from '../src/features/lottery/time'
import { lotteryShareCard } from '../src/features/lottery/share-card'
import type { LotteryCampaignSummary } from '../src/api/lottery'

const read = (path: string) => readFileSync(resolve(__dirname, '..', path), 'utf8')
const api = read('src/api/lottery.ts')
const auth = read('src/api/auth.ts')
const detail = read('src/pages/lottery/detail.tsx')
const config = read('src/app.config.ts')
const drawRequest = read('src/features/lottery/draw-request.ts')
const verificationGuard = read('src/features/academic-verification/guard.ts')

assert.match(api, /\/api\/v1\/lottery\/campaigns/)
assert.match(api, /path: lotteryPath\(campaignId, '\/participations'\)[\s\S]*idempotencyKey/u)
assert.match(api, /path: lotteryPath\(campaignId, '\/draws'\)[\s\S]*idempotencyKey/u)
assert.match(api, /data: \{ token: shareToken \}/u)
assert.match(auth, /lottery_share_token/u)
assert.match(detail, /saveLotteryShareAttribution/u)
assert.match(detail, /submitStoredLotteryShareAttribution/u)
assert.match(detail, /drawKey\.current/u)
assert.match(detail, /savePendingLotteryDrawKey/u)
assert.match(detail, /clearPendingLotteryDrawKey/u)
assert.match(detail, /requestKey: key/u)
assert.match(detail, /setPendingDraw\(false\)/u)
assert.match(detail, /draw_mode === 'scheduled'/u)
assert.match(detail, /lottery-prize-grid/u)
assert.match(detail, /prize\.image_url \|\| giftImage/u)
assert.match(detail, /prize\.total_quantity - prize\.allocated_quantity/u)
assert.match(detail, /setResultsExpanded/u)
assert.match(detail, /loadMorePublicResults/u)
assert.match(detail, /setRulesExpanded/u)
assert.match(api, /export type LotterySponsor/u)
assert.match(api, /sponsors\?: LotterySponsor\[\]/u)
assert.match(detail, /campaign\.sponsors\?\.length/u)
assert.match(detail, /sponsor\.wechat_id/u)
assert.match(detail, /Taro\.setClipboardData\(\{ data: wechatId \}\)/u)
assert.match(detail, /OfficialAccount onError/u)
assert.match(detail, /复制 WeOUC 搜索/u)
assert.match(detail, /campaign\.prizes\.length === 1 \? ' lottery-prize-grid--single'/u)
assert.ok(detail.indexOf("className='lottery-broadcast'") < detail.indexOf("className='lottery-detail-page__content'"), '中奖播报必须位于内容区之前')
assert.match(detail, /lottery-sponsor-card__header/u)
assert.match(detail, /ariaLabel=\{`复制\$\{sponsor\.name\}微信号`\}/u)
assert.match(detail, /lottery-rules-description/u)
assert.match(detail, /copy-3750\.svg/u)
assert.match(detail, /gift-3750\.png/u)
assert.match(detail, /\[rulesExpanded, setRulesExpanded\] = useState\(true\)/u)
assert.doesNotMatch(detail, /100% 必中|官方公证|区块链|全场正品包邮/u)
assert.match(config, /pages\/lottery\/detail/u)
assert.match(drawRequest, /campus\.lottery\.drawRequest/u)
assert.match(drawRequest, /clearAllPendingLotteryDrawKeys/u)
assert.match(auth, /clearAllPendingLotteryDrawKeys\(\)/u)
assert.match(verificationGuard, /'\/pages\/lottery\/detail'/u)

const receivedAt = Date.parse('2026-09-08T00:00:10Z')
const clock = createLotteryServerClock('2026-09-08T00:00:00Z', receivedAt)
assert.equal(lotteryServerNow(clock, receivedAt + 90_000), Date.parse('2026-09-08T00:01:30Z'))
assert.equal(lotteryRemainingLabel('2026-09-08T00:02:00Z', lotteryServerNow(clock, receivedAt)), '2 分后截止')
assert.equal(shouldClearPendingLotteryDraw('lottery_conflict'), true)
assert.equal(shouldClearPendingLotteryDraw('idempotency_conflict'), false)
assert.equal(shouldClearPendingLotteryDraw('network_error'), false)
assert.equal(isLotteryCampaignActive({
  status: 'published', start_at: '2026-09-07T00:00:00Z', end_at: '2026-09-09T00:00:00Z',
} as never, lotteryServerNow(clock, receivedAt)), true)

const shareNow = Date.parse('2026-09-12T12:00:00Z')
const shareCampaign = (overrides: Partial<LotteryCampaignSummary> = {}): LotteryCampaignSummary => ({
  id: 1,
  title: '秋日校园好礼',
  draw_mode: 'instant',
  status: 'published',
  start_at: '2026-09-12T00:00:00Z',
  end_at: '2026-09-13T00:00:00Z',
  cover_url: 'https://cdn.example.test/lottery-cover.png',
  prizes: [{
    id: 1,
    name: '校园保温杯',
    image_url: 'https://cdn.example.test/prize.png',
    total_quantity: 3,
    allocated_quantity: 0,
    instant_probability_bps: 10000,
    scheduled_draw_order: 1,
  }],
  ...overrides,
})

const instantShareCard = lotteryShareCard(shareCampaign(), shareNow)
assert.equal(instantShareCard.title, '邀你参与校园抽奖｜秋日校园好礼')
assert.equal(instantShareCard.heading, '秋日校园好礼')
assert.equal(instantShareCard.status, '即时随机开奖')
assert.equal(instantShareCard.prize, '校园保温杯')
assert.equal(instantShareCard.image, 'https://cdn.example.test/prize.png')
assert.equal(instantShareCard.quantities, '1 种奖品 · 共 3 份')
assert.equal(instantShareCard.footer, '校园认证用户可参与')

const scheduledShareCard = lotteryShareCard(shareCampaign({ draw_mode: 'scheduled' }), shareNow)
assert.equal(scheduledShareCard.status, '到期统一开奖')

const upcomingShareCard = lotteryShareCard(shareCampaign({
  start_at: '2026-09-13T00:00:00Z',
  end_at: '2026-09-14T00:00:00Z',
}), shareNow)
assert.equal(upcomingShareCard.title, '校园抽奖预告｜秋日校园好礼')
assert.equal(upcomingShareCard.status, '活动即将开始')
assert.equal(upcomingShareCard.footer, '提前了解活动规则')

const endedShareCard = lotteryShareCard(shareCampaign({ end_at: '2026-09-12T11:59:59Z' }), shareNow)
assert.equal(endedShareCard.title, '校园抽奖结果｜秋日校园好礼')
assert.equal(endedShareCard.status, '活动已结束')
assert.equal(endedShareCard.footer, '查看活动与中奖结果')

const cancelledShareCard = lotteryShareCard(shareCampaign({
  status: 'cancelled',
  end_at: '2026-09-13T00:00:00Z',
}), shareNow)
assert.equal(cancelledShareCard.title, '校园抽奖结果｜秋日校园好礼')
assert.equal(cancelledShareCard.status, '活动已结束')

const multiPrizeShareCard = lotteryShareCard(shareCampaign({
  prizes: [
    shareCampaign().prizes[0],
    { ...shareCampaign().prizes[0], id: 2, name: '校园帆布袋', total_quantity: 5 },
    { ...shareCampaign().prizes[0], id: 3, name: '校园贴纸', total_quantity: 2 },
  ],
}), shareNow)
assert.equal(multiPrizeShareCard.prize, '校园保温杯')
assert.equal(multiPrizeShareCard.quantities, '3 种奖品 · 共 10 份')

const noImageShareCard = lotteryShareCard(shareCampaign({
  cover_url: null,
  prizes: [{ ...shareCampaign().prizes[0], image_url: null }],
}), shareNow)
assert.equal(noImageShareCard.image, '', '缺图时由绘制层使用稳定礼盒素材兜底')

const fallbackPrizeShareCard = lotteryShareCard(shareCampaign({ prizes: [] }), shareNow)
assert.equal(fallbackPrizeShareCard.prize, '校园惊喜好礼')
assert.equal(fallbackPrizeShareCard.quantities, '0 种奖品 · 共 0 份')
assert.equal(fallbackPrizeShareCard.image, 'https://cdn.example.test/lottery-cover.png')

const privateShareCard = lotteryShareCard({
  ...shareCampaign(),
  user_id: 'user-private-123',
  wechat_id: 'wx-private-456',
  share_token: 'share-private-789',
  code: 'code-private-000',
} as LotteryCampaignSummary, shareNow)
const privateCardJson = JSON.stringify(privateShareCard)
assert.doesNotMatch(privateShareCard.title, /user-private|wx-private|share-private|code-private/u)
assert.doesNotMatch(privateCardJson, /user-private|wx-private|share-private|code-private/u)
assert.equal('user_id' in privateShareCard, false)
assert.equal('wechat_id' in privateShareCard, false)
assert.equal('share_token' in privateShareCard, false)
assert.equal('code' in privateShareCard, false)

process.stdout.write('Lottery miniapp smoke: ok\n')
