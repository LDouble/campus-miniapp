import type { AffiliateGoods } from '../../api/affiliate'

export type AffiliateProductDetailSource = Pick<
  AffiliateGoods,
  'special_text' | 'is_gold_seller' | 'is_overseas' | 'recommendation_text'
>

export type AffiliateProductDetailSourceBadge = {
  key: 'gold-seller' | 'overseas'
  label: string
}

export type AffiliateProductDetailSourceMetadata = {
  badges: AffiliateProductDetailSourceBadge[]
  specialTexts: string[]
  recommendationText: string
}

/** getAffiliateProductDetailSourceMetadata 清理商品源标签并保留原始推广文案。 */
export function getAffiliateProductDetailSourceMetadata(
  product: AffiliateProductDetailSource,
): AffiliateProductDetailSourceMetadata {
  const badges: AffiliateProductDetailSourceBadge[] = []
  if (product.is_gold_seller === true) badges.push({ key: 'gold-seller', label: '金牌卖家' })
  if (product.is_overseas === true) badges.push({ key: 'overseas', label: '海淘' })

  const specialTexts = Array.isArray(product.special_text)
    ? Array.from(new Set(product.special_text
      .filter((text): text is string => typeof text === 'string')
      .map((text) => text.trim())
      .filter(Boolean)))
    : []

  return {
    badges,
    specialTexts,
    recommendationText: typeof product.recommendation_text === 'string'
      ? product.recommendation_text.trim()
      : '',
  }
}
