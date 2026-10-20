import { useState } from 'react'
import { Image, Text, View } from '@tarojs/components'
import type { AffiliateGoods, AffiliateProduct } from '../../../api/affiliate'
import { createAffiliateImageFallbackState } from '../image-fallback'
import {
  getAffiliateCouponStatusForDisplay,
  getAffiliateReferencePrice,
  getAffiliatePurchaseLabel,
  getAffiliatePromotionDisplay,
  hasCurrentAffiliateCoupon,
  useAffiliateOfferClock,
  type AffiliateOfferData,
} from '../promotions'
import type { AffiliateResolutionGoods } from '../resolution-ticket'
import './product-card.scss'

export type AffiliatePurchaseProduct = Pick<
  AffiliateGoods,
  'goods_id' | 'title' | 'coupon_status' | 'availability'
> & Partial<Pick<
  AffiliateGoods,
  'image_url' | 'shop_name' | 'original_price' | 'actual_price' | 'coupon_amount' | 'coupon_condition'
>>
& Pick<AffiliateGoods, 'promotion'>
& Pick<AffiliateResolutionGoods, 'resolution_token' | 'requires_resolution_token'>

type ProductCardProps = {
  product: AffiliateProduct | AffiliateGoods | AffiliateResolutionGoods
  layout?: 'list' | 'tile'
  recommendation?: boolean
  salesLabel?: string
  clockRefreshKey?: string | number | boolean
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

export default function AffiliateProductCard({
  product,
  recommendation = false,
  layout = 'list',
  salesLabel,
  clockRefreshKey,
  canConvert,
  onOpen,
  onBuy,
}: ProductCardProps) {
  const [imageFallback] = useState(createAffiliateImageFallbackState)
  const [, setImageRenderRevision] = useState(0)
  const offer = product as AffiliateOfferData
  const offerNow = useAffiliateOfferClock(offer, clockRefreshKey)
  const activeCoupon = hasCurrentAffiliateCoupon(offer, offerNow)
  const couponStatus = getAffiliateCouponStatusForDisplay(offer, offerNow)
  const promotion = getAffiliatePromotionDisplay(offer.promotion, offerNow)
  const referencePrice = getAffiliateReferencePrice(offer, product.actual_price, product.original_price, offerNow)
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
  const showOriginalPrice = referencePrice.canStrikeOriginalPrice
  const hasVerifiedActualPrice = Boolean(product.actual_price) && (activeCoupon || product.coupon_status === 'none')
  const showCouponStatus = !promotion && (layout !== 'tile' || couponStatus !== 'none')
  const purchaseText = getAffiliatePurchaseLabel(activeCoupon, Boolean(promotion), couponStatus)
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
          {promotion && (
            <View className='affiliate-product-card__offer-badges'>
              <View className='affiliate-product-card__activity-badge'>
                <Text className='affiliate-product-card__activity-kind'>{promotion.typeLabel}</Text>
                {promotion.title !== promotion.typeLabel && (
                  <Text className='affiliate-product-card__activity-title'>{promotion.title}</Text>
                )}
              </View>
              {promotion.discountLabel && (
                <View className='affiliate-product-card__discount-badge'>
                  <Text>{promotion.discountLabel}</Text>
                </View>
              )}
            </View>
          )}
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
            <Text className={`affiliate-product-card__actual-price ${hasVerifiedActualPrice ? '' : 'affiliate-product-card__actual-price--muted'}`}>
              {referencePrice.isCouponPrice
                  ? <Text className='affiliate-product-card__price-prefix'>券后</Text>
                  : promotion && <Text className='affiliate-product-card__price-prefix'>活动参考</Text>}
              {formatPrice(referencePrice.value)}
            </Text>
            {showOriginalPrice && (
              <Text className='affiliate-product-card__original-price'>¥{product.original_price}</Text>
            )}
          </View>
          <View className='affiliate-product-card__coupon-line'>
            {activeCoupon && product.coupon_amount ? (
              <Text className='affiliate-product-card__coupon-amount'>券 ¥{product.coupon_amount}</Text>
            ) : showCouponStatus ? (
              <Text className={`affiliate-product-card__coupon-status affiliate-product-card__coupon-status--${couponStatus}`}>
                {couponLabels[couponStatus]}
              </Text>
            ) : null}
            {salesLabel && layout === 'tile' && <Text className='affiliate-product-card__sales-label'>{salesLabel}</Text>}
            {activeCoupon && product.coupon_condition && layout !== 'tile' && (
              <Text className='affiliate-product-card__coupon-condition'>{product.coupon_condition}</Text>
            )}
          </View>
        </View>
        <View
          className={`affiliate-product-card__buy ${canPurchase ? '' : 'affiliate-product-card__buy--disabled'}`}
          ariaRole='button'
          ariaLabel={resolutionTokenMissing
            ? '解析凭证不可用，重新解析后购买'
            : canPurchase ? `${purchaseText}商品` : canConvert ? '商品暂不可购买' : '推广购买暂不可用'}
          onClick={() => {
            if (canPurchase) onBuy(product)
          }}
        >
          {layout === 'tile' && canPurchase && !resolutionTokenMissing ? '+' : !canConvert
            ? '推广暂不可用'
            : product.availability === 'valid'
            ? resolutionTokenMissing ? '重新解析' : purchaseText
            : '暂不可购'}
        </View>
      </View>
    </View>
  )
}
