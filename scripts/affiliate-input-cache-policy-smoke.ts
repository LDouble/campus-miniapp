import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import Module = require('node:module')
import {
  classifyAffiliateSearchInput,
  dispatchAffiliateSearchInput,
} from '../src/features/affiliate/search-input-policy'
import {
  canUseAffiliateCapability,
  isCurrentAffiliateCopyOperation,
  normalizeAffiliateCapabilities,
  shouldClearAffiliateGoodsCache,
} from '../src/features/affiliate/capability-policy'
import {
  cacheAffiliateGoods,
  clearAffiliateGoodsCache,
  getCachedAffiliateGoods,
} from '../src/features/affiliate/session-cache'
import type { AffiliateGoods } from '../src/api/affiliate'

const enabled = normalizeAffiliateCapabilities({
  enabled: true,
  search_enabled: true,
  resolve_enabled: true,
  convert_enabled: true,
})
const convertDisabled = normalizeAffiliateCapabilities({
  ...enabled,
  convert_enabled: false,
})
const convertReenabled = normalizeAffiliateCapabilities({
  ...enabled,
  convert_enabled: true,
})

let bootstrapAffiliate: unknown = enabled
const originalLoad = Module._load
Module._load = function loadAffiliateCapabilityBootstrap(request, parent, isMain) {
  if (request === '../../api/client-bootstrap'
    && parent?.filename.endsWith('/features/affiliate/capabilities.ts')) {
    return { getClientBootstrap: async () => ({ affiliate: bootstrapAffiliate }) }
  }
  return originalLoad.call(this, request, parent, isMain)
}
const capabilityStore = require('../src/features/affiliate/capabilities') as typeof import('../src/features/affiliate/capabilities')
Module._load = originalLoad

const keyword = classifyAffiliateSearchInput('  宿舍收纳盒  ')
assert.deepEqual(keyword, { type: 'keyword', keyword: '宿舍收纳盒' })
assert.deepEqual(classifyAffiliateSearchInput('淘宝手机壳'), {
  type: 'keyword',
  keyword: '淘宝手机壳',
}, '普通关键词提到淘宝时仍应走商品库搜索')

const url = classifyAffiliateSearchInput('https://item.taobao.com/item.htm?id=123456')
assert.deepEqual(url, {
  type: 'resolve',
  content: 'https://item.taobao.com/item.htm?id=123456',
  reason: 'url',
})

const shareText = classifyAffiliateSearchInput('复制这条信息￥Abc1234567￥，打开淘宝查看商品')
assert.deepEqual(shareText, {
  type: 'resolve',
  content: '复制这条信息￥Abc1234567￥，打开淘宝查看商品',
  reason: 'share',
})

const token = classifyAffiliateSearchInput('￥Abc1234567￥')
assert.deepEqual(token, {
  type: 'resolve',
  content: '￥Abc1234567￥',
  reason: 'taokouling',
})

const unsupportedUrl = classifyAffiliateSearchInput('https://not-taobao.example/product/123')
assert.equal(unsupportedUrl.type, 'resolve', '无法识别的链接也应交给解析接口明确拒绝')
assert.equal(classifyAffiliateSearchInput('item.taobao.com/item.htm?id=123').type, 'resolve')
const malformedLinks = [
  'https://',
  'https:/item.taobao.com/item.htm?id=123',
  'www.',
  'not-taobao.example/product/123',
  'item.taobao.com',
]
for (const content of malformedLinks) {
  assert.equal(
    classifyAffiliateSearchInput(content).type,
    'resolve',
    `${content} 看起来像链接，不能静默作为关键词搜索`,
  )
}

const dispatched: string[] = []
const urlRoute = dispatchAffiliateSearchInput(url.content, {
  search: (value) => { dispatched.push(`search:${value}`) },
  resolve: (value) => { dispatched.push(`resolve:${value}`) },
})
assert.equal(urlRoute.type, 'resolve')
assert.deepEqual(dispatched, [`resolve:${url.content}`])
for (const content of [shareText.content, token.content, 'https://not-taobao.example/product/123', ...malformedLinks]) {
  const route = dispatchAffiliateSearchInput(content, {
    search: (value) => { dispatched.push(`search:${value}`) },
    resolve: (value) => { dispatched.push(`resolve:${value}`) },
  })
  assert.equal(route.type, 'resolve')
  assert.equal(dispatched[dispatched.length - 1], `resolve:${content}`)
}
assert.equal(dispatched.filter((entry) => entry.startsWith('search:')).length, 0,
  '任何有效或无效但看起来像链接的输入都不能发关键词搜索')

const keywordRequestIndex = dispatched.length
const keywordRoute = dispatchAffiliateSearchInput('宿舍收纳盒', {
  search: (value) => { dispatched.push(`search:${value}`) },
  resolve: (value) => { dispatched.push(`resolve:${value}`) },
})
assert.equal(keywordRoute.type, 'keyword')
assert.equal(dispatched[keywordRequestIndex], 'search:宿舍收纳盒')

const tooLongKeyword = classifyAffiliateSearchInput('收纳'.repeat(51))
assert.deepEqual(tooLongKeyword, { type: 'too_long', reason: 'keyword' })
assert.deepEqual(classifyAffiliateSearchInput('分享内容'.repeat(513)), {
  type: 'too_long',
  reason: 'content',
})
const requestCountBeforeTooLongInput = dispatched.length
dispatchAffiliateSearchInput('收纳'.repeat(51), {
  search: (value) => { dispatched.push(`search:${value}`) },
  resolve: (value) => { dispatched.push(`resolve:${value}`) },
})
assert.equal(dispatched.length, requestCountBeforeTooLongInput, '超长关键词不能触发商品搜索或解析')

const goods = {
  goods_id: 'cached-goods-1',
  title: '已缓存商品',
} as AffiliateGoods
clearAffiliateGoodsCache()
capabilityStore.seedAffiliateCapabilities(enabled)
cacheAffiliateGoods(goods)

assert.equal(shouldClearAffiliateGoodsCache(enabled, convertDisabled, true), false)
const revisionBeforeConvertOff = capabilityStore.getAffiliateCapabilitySnapshot().revision
capabilityStore.seedAffiliateCapabilities(convertDisabled)
assert.equal(getCachedAffiliateGoods(goods.goods_id), goods)
assert.equal(capabilityStore.getAffiliateCapabilitySnapshot().revision, revisionBeforeConvertOff + 1)
assert.equal(canUseAffiliateCapability(capabilityStore.getAffiliateCapabilitySnapshot().capabilities, 'convert'), false)
assert.equal(canUseAffiliateCapability(capabilityStore.getAffiliateCapabilitySnapshot().capabilities, 'search'), true)
assert.equal(canUseAffiliateCapability(capabilityStore.getAffiliateCapabilitySnapshot().capabilities, 'resolve'), true)

const oldCopyIdentity = {
  requestRevision: 4,
  capabilityRevision: capabilityStore.getAffiliateCapabilitySnapshot().revision,
  goodsId: goods.goods_id,
}
assert.equal(isCurrentAffiliateCopyOperation(oldCopyIdentity, oldCopyIdentity, convertDisabled), false)
assert.equal(shouldClearAffiliateGoodsCache(convertDisabled, convertReenabled, true), false)
bootstrapAffiliate = convertReenabled
const revisionBeforeConvertOn = capabilityStore.getAffiliateCapabilitySnapshot().revision
capabilityStore.seedAffiliateCapabilities(bootstrapAffiliate as typeof enabled)
assert.equal(capabilityStore.getAffiliateCapabilitySnapshot().revision, revisionBeforeConvertOn + 1)
assert.equal(getCachedAffiliateGoods(goods.goods_id), goods)
const reenabledIdentity = {
  ...oldCopyIdentity,
  capabilityRevision: capabilityStore.getAffiliateCapabilitySnapshot().revision,
}
assert.equal(isCurrentAffiliateCopyOperation(
  reenabledIdentity,
  oldCopyIdentity,
  capabilityStore.getAffiliateCapabilitySnapshot().capabilities,
), false)

assert.equal(shouldClearAffiliateGoodsCache(enabled, {
  ...enabled,
  search_enabled: false,
}, true), true)
assert.equal(shouldClearAffiliateGoodsCache(enabled, {
  ...enabled,
  resolve_enabled: false,
}, true), true)
assert.equal(shouldClearAffiliateGoodsCache(enabled, normalizeAffiliateCapabilities(undefined), true), true)
assert.equal(shouldClearAffiliateGoodsCache(enabled, enabled, false), true)

capabilityStore.seedAffiliateCapabilities(enabled)
cacheAffiliateGoods(goods)
capabilityStore.seedAffiliateCapabilities({
  ...enabled,
  search_enabled: false,
})
assert.equal(getCachedAffiliateGoods(goods.goods_id), undefined)

const read = (path: string) => readFileSync(path, 'utf8')
const searchPage = read('src/pages/goods/search.tsx')
const capabilities = read('src/features/affiliate/capabilities.ts')
const detailPage = read('src/pages/goods/detail.tsx')
assert.match(searchPage, /dispatchAffiliateSearchInput\(/u)
assert.match(searchPage, /resolve:\s*\(content\)[\s\S]*handlePasteAndResolve\(content\)/u)
assert.match(searchPage, /搜索范围：仅限已接入商品库/u)
assert.match(searchPage, /不会作为关键词搜索/u)
assert.match(searchPage, /maxlength=\{2048\}/u)
assert.match(searchPage, /解析内容/u)
assert.match(capabilities, /shouldClearAffiliateGoodsCache\(/u)
assert.match(capabilities, /revision:\s*snapshot\.revision \+ 1/u)
assert.match(detailPage, /getCachedAffiliateGoods\(route\.goodsId\)/u)
assert.match(detailPage, /convertEnabled && product\.availability === 'valid'/u)

clearAffiliateGoodsCache()
console.log('affiliate input/cache policy smoke passed')
