import { strict as assert } from 'node:assert'
import { canShowMemberAd } from '../src/features/member-ad-popup/policy'

assert.equal(canShowMemberAd(1, ['member']), true)
assert.equal(canShowMemberAd(1, ['admin', 'member']), true)
assert.equal(canShowMemberAd(1, ['guest']), false)
assert.equal(canShowMemberAd(0, ['member']), false)
assert.equal(canShowMemberAd(1, []), false)
assert.equal(canShowMemberAd(1, ['member']), true)
const frequencyNow = 1_800_000_000_000
const threeDays = 72 * 60 * 60 * 1000
assert.equal(canShowMemberAd(1, ['member'], frequencyNow - threeDays + 1, frequencyNow), false, '不足72小时不得准备广告')
assert.equal(canShowMemberAd(1, ['member'], frequencyNow - threeDays, frequencyNow), true, '满72小时才允许再次准备')
assert.equal(canShowMemberAd(1, ['member'], frequencyNow + 1, frequencyNow), false, '时间回拨时保持冷却')
for (const invalid of [0, -1, NaN, Infinity, 'invalid', {}, []]) {
  assert.equal(canShowMemberAd(1, ['member'], invalid, frequencyNow), false, '损坏记录不能绕过频控')
}
console.log('会员广告：member身份、72小时间隔、损坏记录和时钟回拨检查通过')

// 构建适配必须保留原广告事件，并为 Taro 遗漏的关闭事件提供原生绑定。
const { sources } = require('webpack')
const compatPlugin = require('../config/plugins/weapp-compat.js')
const previousEnv = process.env.TARO_ENV
process.env.TARO_ENV = 'weapp'
let transform: (input: { assets: Record<string, unknown> }) => void
compatPlugin({ modifyBuildAssets: (callback) => { transform = callback } })
const assets = { 'base.wxml': new sources.RawSource('<ad-custom bindload="eh" binderror="eh"></ad-custom>') }
transform!({ assets })
assert.equal(assets['base.wxml'].source(), '<ad-custom bindload="eh" binderror="eh" bindclose="eh"></ad-custom>')
transform!({ assets })
assert.equal(String(assets['base.wxml'].source()).match(/bindclose=/g)?.length, 1)
if (previousEnv === undefined) delete process.env.TARO_ENV
else process.env.TARO_ENV = previousEnv
console.log('广告原生事件绑定与重复构建检查通过')

const { preloadMemberAd, MEMBER_AD_UNIT_ID } = require('../src/features/member-ad-popup/preload')
const preloadCalls: unknown[] = []
assert.equal(preloadMemberAd({ preloadAd: (ads) => { preloadCalls.push(ads) } }), true)
assert.deepEqual(preloadCalls, [[{ unitId: MEMBER_AD_UNIT_ID, type: 'custom' }]])
assert.equal(preloadMemberAd({}), false, '旧基础库没有预加载能力时仍可正常挂载广告')
assert.equal(preloadMemberAd({ preloadAd: () => { throw new Error('unsupported') } }), false)
assert.equal(preloadMemberAd({ preloadAd: () => Promise.reject(new Error('network')) }), true)
console.log('广告预加载：原生模板参数、旧基础库与调用异常检查通过')
