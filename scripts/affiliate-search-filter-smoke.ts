import { strict as assert } from 'node:assert'
import Module = require('node:module')
import { validateAffiliateSearchFilter } from '../src/features/affiliate/search-filters'
import {
  AFFILIATE_GOODS_SEARCH_CATEGORIES,
  type AffiliateGoodsSearchCategoryId,
  isAffiliateGoodsSearchCategoryId,
} from '../src/features/affiliate/search-categories'
import { shouldContinueAffiliateSearch } from '../src/features/affiliate/search-pagination'

assert.deepEqual(
  AFFILIATE_GOODS_SEARCH_CATEGORIES.map(({ id }) => id),
  Array.from({ length: 14 }, (_, index) => index + 1),
)
assert.deepEqual(
  AFFILIATE_GOODS_SEARCH_CATEGORIES.map(({ label }) => label),
  ['女装', '母婴', '美妆', '居家日用', '鞋品', '美食', '文娱车品', '数码家电', '男装', '内衣', '箱包', '配饰', '户外运动', '家装家纺'],
)
assert.equal(isAffiliateGoodsSearchCategoryId(1), true)
assert.equal(isAffiliateGoodsSearchCategoryId(14), true)
assert.equal(isAffiliateGoodsSearchCategoryId(0), false)
assert.equal(isAffiliateGoodsSearchCategoryId(15), false)

const valid = validateAffiliateSearchFilter({ hasCouponOnly: true, minPrice: '0', maxPrice: '19.99' })
assert.equal(valid.valid, true)
assert.deepEqual(valid.filters, { has_coupon: true, min_price: '0', max_price: '19.99' })

const selectedCategory = validateAffiliateSearchFilter({
  hasCouponOnly: true,
  categoryId: 4,
  minPrice: '0',
  maxPrice: '19.99',
})
assert.equal(selectedCategory.valid, true)
assert.deepEqual(selectedCategory.filters, {
  category_id: 4,
  has_coupon: true,
  min_price: '0',
  max_price: '19.99',
})
assert.deepEqual(
  validateAffiliateSearchFilter({ hasCouponOnly: false, categoryId: undefined, minPrice: '', maxPrice: '' }).filters,
  {},
  '全部分类应省略 category_id',
)
const invalidCategory = validateAffiliateSearchFilter({
  hasCouponOnly: false,
  categoryId: 0 as AffiliateGoodsSearchCategoryId,
  minPrice: '',
  maxPrice: '',
})
assert.equal(invalidCategory.valid, false, '0 代表全部，客户端应将其转换成省略分类参数')
assert.equal(invalidCategory.message, '请选择有效的商品分类。')

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
const overBackendLimit = validateAffiliateSearchFilter({ hasCouponOnly: false, minPrice: '1000000000', maxPrice: '' })
assert.equal(overBackendLimit.valid, false, '金额不得超过后端允许的 9 位整数')
const largestInteger = validateAffiliateSearchFilter({ hasCouponOnly: false, minPrice: '999999999.99', maxPrice: '' })
assert.equal(largestInteger.valid, true, '后端允许的最大九位整数和两位小数应通过校验')
const leadingZero = validateAffiliateSearchFilter({ hasCouponOnly: false, minPrice: '01.00', maxPrice: '' })
assert.equal(leadingZero.valid, false, '金额不得使用后端不接受的前导零')

assert.equal(shouldContinueAffiliateSearch(1, 20, 45, 20), true)
assert.equal(shouldContinueAffiliateSearch(2, 20, 45, 20), true)
assert.equal(shouldContinueAffiliateSearch(3, 20, 45, 5), false)
assert.equal(shouldContinueAffiliateSearch(2, 20, 40, 20), false)
assert.equal(shouldContinueAffiliateSearch(2, 20, 80, 0), false)

async function verifyAffiliateSearchQuery() {
  const originalLoad = (Module as any)._load
  let capturedOptions: { path: string; query: Record<string, unknown> } | undefined

  ;(Module as any)._load = function (request: string, parent: { filename?: string }, isMain: boolean) {
    if (request === './client' && parent?.filename?.endsWith('/src/api/affiliate.ts')) {
      return {
        apiRequest: async (options: { path: string; query: Record<string, unknown> }) => {
          capturedOptions = options
          return {}
        },
      }
    }
    return originalLoad.call(this, request, parent, isMain)
  }

  try {
    const { searchAffiliateGoods } = require('../src/api/affiliate')
    await searchAffiliateGoods('耳机', 2, {
      category_id: 4,
      has_coupon: true,
      min_price: '10',
      max_price: '20',
      sort: 'sales',
    })
    assert.deepEqual(capturedOptions, {
      path: '/api/v1/affiliate/search',
      query: {
        keyword: '耳机',
        page: 2,
        page_size: 20,
        category_id: 4,
        has_coupon: true,
        min_price: '10',
        max_price: '20',
        sort: 'sales',
      },
    })

    await searchAffiliateGoods('耳机', 1, { sort: 'comprehensive' })
    assert.equal(capturedOptions?.query.category_id, undefined, '全部分类不得向后端发送 category_id=0')
  } finally {
    ;(Module as any)._load = originalLoad
  }
}

void verifyAffiliateSearchQuery().then(() => {
  console.log('Affiliate search filter and pagination smoke passed')
}).catch((error) => {
  console.error(error)
  process.exitCode = 1
})
