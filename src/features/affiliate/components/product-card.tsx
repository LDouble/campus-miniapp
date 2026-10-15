import { useEffect, useState } from 'react'
import { Image, Text, View } from '@tarojs/components'
import type { AffiliateGoods, AffiliateProduct } from '../../../api/affiliate'
import './product-card.scss'

export type AffiliatePurchaseProduct = Pick<
  AffiliateGoods,
  'goods_id' | 'title' | 'coupon_status' | 'availability'
> & Partial<Pick<
  AffiliateGoods,
  'image_url' | 'shop_name' | 'original_price' | 'actual_price' | 'coupon_amount' | 'coupon_condition'
>>

type ProductCardProps = {
  product: AffiliateProduct | AffiliateGoods
  recommendation?: boolean
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
  onOpen,
  onBuy,
}: ProductCardProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const hasImage = Boolean(product.image_url) && !imageFailed
  const recommendationTitle = 'recommendation_title' in product
    ? product.recommendation_title
    : undefined
  const recommendationReason = 'recommendation_reason' in product
    ? product.recommendation_reason
    : undefined

  useEffect(() => setImageFailed(false), [product.image_url])

  return (
    <View className='affiliate-product-card'>
      <View
        className={`affiliate-product-card__main ${onOpen ? 'affiliate-product-card__main--link' : ''}`}
        ariaRole={onOpen ? 'button' : undefined}
        ariaLabel={onOpen ? `查看商品，${product.title}` : undefined}
        onClick={onOpen}
      >
        <View className='affiliate-product-card__image-wrap'>
          {hasImage ? (
            <Image
              className='affiliate-product-card__image'
              src={product.image_url || ''}
              mode='aspectFill'
              lazyLoad
              onError={() => setImageFailed(true)}
            />
          ) : (
            <View className='affiliate-product-card__image-placeholder'>
              <View className='affiliate-product-card__bag-icon' />
            </View>
          )}
        </View>
        <View className='affiliate-product-card__copy'>
          {recommendation && recommendationTitle && (
            <Text className='affiliate-product-card__eyebrow'>{recommendationTitle}</Text>
          )}
          <Text className='affiliate-product-card__title'>{product.title}</Text>
          {recommendation && recommendationReason && (
            <Text className='affiliate-product-card__reason'>{recommendationReason}</Text>
          )}
          {product.shop_name && (
            <Text className='affiliate-product-card__shop'>{product.shop_name}</Text>
          )}
        </View>
      </View>

      <View className='affiliate-product-card__price-row'>
        <View className='affiliate-product-card__price-copy'>
          <View className='affiliate-product-card__prices'>
            {product.actual_price ? (
              <Text className='affiliate-product-card__actual-price'>{formatPrice(product.actual_price)}</Text>
            ) : (
              <Text className='affiliate-product-card__actual-price affiliate-product-card__actual-price--muted'>
                {formatPrice(product.original_price)}
              </Text>
            )}
            {product.original_price && product.actual_price && (
              <Text className='affiliate-product-card__original-price'>¥{product.original_price}</Text>
            )}
          </View>
          <View className='affiliate-product-card__coupon-line'>
            {product.coupon_status === 'active' && product.coupon_amount ? (
              <Text className='affiliate-product-card__coupon-amount'>券 ¥{product.coupon_amount}</Text>
            ) : (
              <Text className={`affiliate-product-card__coupon-status affiliate-product-card__coupon-status--${product.coupon_status}`}>
                {couponLabels[product.coupon_status]}
              </Text>
            )}
            {product.coupon_condition && (
              <Text className='affiliate-product-card__coupon-condition'>{product.coupon_condition}</Text>
            )}
          </View>
        </View>
        <View
          className={`affiliate-product-card__buy ${product.availability !== 'valid' ? 'affiliate-product-card__buy--disabled' : ''}`}
          ariaRole='button'
          ariaLabel={product.availability === 'valid' ? '生成推广链接' : '商品暂不可购买'}
          onClick={() => {
            if (product.availability === 'valid') onBuy(product)
          }}
        >
          {product.availability === 'valid'
            ? purchaseLabel(product.coupon_status)
            : '暂不可购'}
        </View>
      </View>
    </View>
  )
}
