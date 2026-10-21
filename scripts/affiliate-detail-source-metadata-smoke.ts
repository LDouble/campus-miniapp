import { strict as assert } from 'node:assert'
import { getAffiliateProductDetailSourceMetadata } from '../src/features/affiliate/detail-source-metadata'

const available = getAffiliateProductDetailSourceMetadata({
  special_text: [' A5牛皮本2本5.9 ', '', 'A5牛皮本2本5.9', '立减2.9'],
  is_gold_seller: true,
  is_overseas: true,
  recommendation_text: '  券后价格及优惠条件请以商品页为准。  ',
})
assert.deepEqual(available.badges, [
  { key: 'gold-seller', label: '金牌卖家' },
  { key: 'overseas', label: '海淘' },
])
assert.deepEqual(available.specialTexts, ['A5牛皮本2本5.9', '立减2.9'])
assert.equal(available.recommendationText, '券后价格及优惠条件请以商品页为准。')

const historical = getAffiliateProductDetailSourceMetadata({
  special_text: null,
  is_gold_seller: false,
  is_overseas: null,
  recommendation_text: '   ',
})
assert.deepEqual(historical, { badges: [], specialTexts: [], recommendationText: '' })

const sourceCopy = getAffiliateProductDetailSourceMetadata({
  recommendation_text: '【券后16.9元，到手14.9元】商家推广信息',
})
assert.equal(sourceCopy.recommendationText, '【券后16.9元，到手14.9元】商家推广信息')
assert.equal('price' in sourceCopy, false, '源推广文案仅作为文本展示，不解析为价格')
console.log('affiliate detail source metadata: ok')
