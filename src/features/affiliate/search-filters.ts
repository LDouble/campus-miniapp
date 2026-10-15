import type { AffiliateGoodsSearchFilters } from '../../api/affiliate'

export type AffiliateSearchFilterDraft = {
  hasCouponOnly: boolean
  minPrice: string
  maxPrice: string
}

export type AffiliateSearchFilterValidation = {
  valid: boolean
  message: string
  filters: Pick<AffiliateGoodsSearchFilters, 'has_coupon' | 'min_price' | 'max_price'>
}

const normalizePrice = (value: string) => value.trim()

const priceToCents = (value: string) => {
  const [integerPart, decimalPart = ''] = value.split('.')
  return Number(integerPart) * 100 + Number(decimalPart.padEnd(2, '0'))
}

/** 校验关键词搜索价格筛选，并将空金额转换为未设置。 */
export const validateAffiliateSearchFilter = (
  draft: AffiliateSearchFilterDraft,
): AffiliateSearchFilterValidation => {
  const minPrice = normalizePrice(draft.minPrice)
  const maxPrice = normalizePrice(draft.maxPrice)
  const pricePattern = /^\d{1,13}(?:\.\d{1,2})?$/

  if (minPrice && !pricePattern.test(minPrice)) {
    return {
      valid: false,
      message: '最低价请输入数字，最多保留两位小数。',
      filters: {},
    }
  }
  if (maxPrice && !pricePattern.test(maxPrice)) {
    return {
      valid: false,
      message: '最高价请输入数字，最多保留两位小数。',
      filters: {},
    }
  }
  if (minPrice && maxPrice && priceToCents(minPrice) > priceToCents(maxPrice)) {
    return {
      valid: false,
      message: '最低价不能高于最高价。',
      filters: {},
    }
  }

  return {
    valid: true,
    message: '',
    filters: {
      ...(draft.hasCouponOnly ? { has_coupon: true } : {}),
      ...(minPrice ? { min_price: minPrice } : {}),
      ...(maxPrice ? { max_price: maxPrice } : {}),
    },
  }
}
