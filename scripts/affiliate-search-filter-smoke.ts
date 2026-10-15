import { strict as assert } from 'node:assert'
import { validateAffiliateSearchFilter } from '../src/features/affiliate/search-filters'
import { shouldContinueAffiliateSearch } from '../src/features/affiliate/search-pagination'

const valid = validateAffiliateSearchFilter({ hasCouponOnly: true, minPrice: '0', maxPrice: '19.99' })
assert.equal(valid.valid, true)
assert.deepEqual(valid.filters, { has_coupon: true, min_price: '0', max_price: '19.99' })

const equalRange = validateAffiliateSearchFilter({ hasCouponOnly: false, minPrice: '19.90', maxPrice: '19.9' })
assert.equal(equalRange.valid, true)
assert.deepEqual(equalRange.filters, { min_price: '19.90', max_price: '19.9' })

const emptyRange = validateAffiliateSearchFilter({ hasCouponOnly: false, minPrice: '  ', maxPrice: '' })
assert.equal(emptyRange.valid, true)
assert.deepEqual(emptyRange.filters, {})

const tooPrecise = validateAffiliateSearchFilter({ hasCouponOnly: false, minPrice: '12.345', maxPrice: '' })
assert.equal(tooPrecise.valid, false)
assert.match(tooPrecise.message, /两位小数/)

const negative = validateAffiliateSearchFilter({ hasCouponOnly: false, minPrice: '-1', maxPrice: '' })
assert.equal(negative.valid, false)

const invertedRange = validateAffiliateSearchFilter({ hasCouponOnly: false, minPrice: '20.01', maxPrice: '20' })
assert.equal(invertedRange.valid, false)
assert.match(invertedRange.message, /最低价不能高于最高价/)

const overlong = validateAffiliateSearchFilter({ hasCouponOnly: false, minPrice: '12345678901234', maxPrice: '' })
assert.equal(overlong.valid, false)

assert.equal(shouldContinueAffiliateSearch(1, 20, 45, 20), true)
assert.equal(shouldContinueAffiliateSearch(2, 20, 45, 20), true)
assert.equal(shouldContinueAffiliateSearch(3, 20, 45, 5), false)
assert.equal(shouldContinueAffiliateSearch(2, 20, 40, 20), false)
assert.equal(shouldContinueAffiliateSearch(2, 20, 80, 0), false)

console.log('Affiliate search filter and pagination smoke passed')
