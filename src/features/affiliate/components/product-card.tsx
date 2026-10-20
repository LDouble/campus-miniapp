import { useState } from 'react'
import { Image, Text, View } from '@tarojs/components'
import type { AffiliateGoods, AffiliateProduct } from '../../../api/affiliate'
import { compareAffiliateAmounts } from '../amount'
import { createAffiliateImageFallbackState } from '../image-fallback'
import type { AffiliateResolutionGoods } from '../resolution-ticket'
import './product-card.scss'

export type AffiliatePurchaseProduct = Pick<
  AffiliateGoods,
  'goods_id' | 'title' | 'coupon_status' | 'availability'
> & Partial<Pick<
  AffiliateGoods,
  'image_url' | 'shop_name' | 'original_price' | 'actual_price' | 'coupon_amount' | 'coupon_condition'
>>
& Pick<AffiliateResolutionGoods, 'resolution_token' | 'requires_resolution_token'>

type ProductCardProps = {
  product: AffiliateProduct | AffiliateGoods | AffiliateResolutionGoods
  layout?: 'list' | 'tile'
  recommendation?: boolean
  salesLabel?: string
  canConvert: boolean
  onOpen?: () => void
  onBuy: (product: AffiliatePurchaseProduct) => void
}

const couponLabels: Record<AffiliateGoods['coupon_status'], string> = {
  unknown: '优惠待核验',
  not_started: '优惠未开始',
  active: '优惠券可用',
  expired: '优惠已结束',
  sold_out: '优惠券已领完',
  none: '暂无优惠券',
}

const formatPrice = (value?: string | null) => (
  value ? `¥${value}` : '价格暂缺'
)

const purchaseLabel = (couponStatus: AffiliateGoods['coupon_status']) => {
  if (couponStatus === 'active') return '领券购买'
  if (couponStatus === 'unknown' || couponStatus === 'not_started') return '查看优惠'
  return '购买商品'
}

export default function AffiliateProductCard({
  product,
  recommendation = false,
  layout = 'list',
  salesLabel,
  canConvert,
  onOpen,
  onBuy,
}: ProductCardProps) {
  const [imageFallback] = useState(createAffiliateImageFallbackState)
  const [, setImageRenderRevision] = useState(0)
  const imageIdentity = 'id' in product ? `product:${product.id}` : `goods:${product.goods_id}`
  const imageSourceKey = `${imageIdentity}|${product.image_url || ''}`
  const imageToken = imageFallback.select(imageSourceKey)
  const hasImage = Boolean(product.image_url) && !imageFallback.isFailed(imageToken)
  const recommendationTitle = 'recommendation_title' in product
    ? product.recommendation_title
    : undefined
  const recommendationReason = 'recommendation_reason' in product
    ? product.recommendation_reason
    : undefined
  const canPurchase = canConvert && product.availability === 'valid'
  const showOriginalPrice = compareAffiliateAmounts(product.original_price, product.actual_price) === 1
  const resolutionTokenMissing = 'requires_resolution_token' in product
    && product.requires_resolution_token === true
    && (typeof product.resolution_token !== 'string' || !product.resolution_token.trim())

  return (
    <View className={`affiliate-product-card ${layout === 'tile' ? 'affiliate-product-card--tile' : ''}`}>
      <View
        className={`affiliate-product-card__main ${onOpen ? 'affiliate-product-card__main--link' : ''}`}
        ariaRole={onOpen ? 'button' : undefined}
        ariaLabel={onOpen ? `查看商品，${product.title}` : undefined}
        onClick={onOpen}
      >
        <View className='affiliate-product-card__image-wrap'>
          {hasImage ? (
            <Image
              key={imageToken}
              className='affiliate-product-card__image'
              src={product.image_url || ''}
              mode='aspectFill'
              lazyLoad
              onError={() => {
                if (imageFallback.markFailed(imageToken)) {
                  setImageRenderRevision((revision) => revision + 1)
                }
              }}
            />
          ) : (
            <View className='affiliate-product-card__image-placeholder'>
              <View className='affiliate-product-card__bag-icon' />
            </View>
          )}
        </View>
        <View className='affiliate-product-card__copy'>
          <View className='affiliate-product-card__promotion'>推广</View>
          {recommendation && recommendationTitle && (
            <Text className='affiliate-product-card__eyebrow'>{recommendationTitle}</Text>
          )}
          <Text className='affiliate-product-card__title'>{product.title}</Text>
          {salesLabel && layout !== 'tile' && <Text className='affiliate-product-card__sales-label'>{salesLabel}</Text>}
          {recommendation && recommendationReason && (
            <Text className='affiliate-product-card__reason'>{recommendationReason}</Text>
          )}
          {product.shop_name && layout !== 'tile' && (
            <Text className='affiliate-product-card__shop'>{product.shop_name}</Text>
          )}
        </View>
      </View>

      <View className='affiliate-product-card__price-row'>
        <View className='affiliate-product-card__price-copy'>
          <View className='affiliate-product-card__prices'>
            {product.actual_price ? (
              <Text className='affiliate-product-card__actual-price'>
                {layout === 'tile' && product.coupon_status === 'active' && <Text className='affiliate-product-card__price-prefix'>券后</Text>}
                {formatPrice(product.actual_price)}
              </Text>
            ) : (
              <Text className='affiliate-product-card__actual-price affiliate-product-card__actual-price--muted'>
                {formatPrice(product.original_price)}
              </Text>
            )}
            {showOriginalPrice && (
              <Text className='affiliate-product-card__original-price'>¥{product.original_price}</Text>
            )}
          </View>
          <View className='affiliate-product-card__coupon-line'>
            {product.coupon_status === 'active' && product.coupon_amount ? (
              <Text className='affiliate-product-card__coupon-amount'>券 ¥{product.coupon_amount}</Text>
            ) : layout !== 'tile' || product.coupon_status !== 'none' ? (
              <Text className={`affiliate-product-card__coupon-status affiliate-product-card__coupon-status--${product.coupon_status}`}>
                {couponLabels[product.coupon_status]}
              </Text>
            ) : null}
            {salesLabel && layout === 'tile' && <Text className='affiliate-product-card__sales-label'>{salesLabel}</Text>}
            {product.coupon_condition && layout !== 'tile' && (
              <Text className='affiliate-product-card__coupon-condition'>{product.coupon_condition}</Text>
            )}
          </View>
        </View>
        <View
          className={`affiliate-product-card__buy ${canPurchase ? '' : 'affiliate-product-card__buy--disabled'}`}
          ariaRole='button'
          ariaLabel={resolutionTokenMissing
            ? '解析凭证不可用，重新解析后购买'
            : canPurchase ? '生成推广链接' : canConvert ? '商品暂不可购买' : '推广购买暂不可用'}
          onClick={() => {
            if (canPurchase) onBuy(product)
          }}
        >
          {layout === 'tile' && canPurchase && !resolutionTokenMissing ? '+' : !canConvert
            ? '推广暂不可用'
            : product.availability === 'valid'
            ? resolutionTokenMissing ? '重新解析' : purchaseLabel(product.coupon_status)
            : '暂不可购'}
        </View>
      </View>
    </View>
  )
}
