import { formatDateTime } from '../life-services/format'

type AffiliateProductDetailMetadataSource = {
  coupon_end_at?: string | null
  snapshot_at?: string | null
}

export type AffiliateProductDetailMetadata = {
  key: 'coupon_end_at' | 'snapshot_at'
  label: string
  value: string
}

/** getAffiliateProductDetailMetadata 只展示商品实际提供的优惠截止与快照时间。 */
export function getAffiliateProductDetailMetadata(
  product: AffiliateProductDetailMetadataSource,
): AffiliateProductDetailMetadata[] {
  const metadata: AffiliateProductDetailMetadata[] = []
  const couponEndAt = product.coupon_end_at?.trim()
  const snapshotAt = product.snapshot_at?.trim()

  if (couponEndAt) {
    metadata.push({
      key: 'coupon_end_at',
      label: '优惠券截止',
      value: formatDateTime(couponEndAt),
    })
  }
  if (snapshotAt) {
    metadata.push({
      key: 'snapshot_at',
      label: '数据更新时间',
      value: formatDateTime(snapshotAt),
    })
  }
  return metadata
}
