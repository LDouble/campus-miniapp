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

process.stdout.write('Lottery miniapp smoke: ok\n')
