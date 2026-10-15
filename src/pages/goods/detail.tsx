import { useState } from 'react'
import Taro, { useDidHide, useDidShow, useLoad } from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import {
  getAffiliateProduct,
  type AffiliateGoods,
  type AffiliateProduct,
} from '../../api/affiliate'
import CustomNavbar from '../../components/custom-navbar'
import type { AffiliatePurchaseProduct } from '../../features/affiliate/components/product-card'
import CouponPurchaseSheet from '../../features/affiliate/components/coupon-purchase-sheet'
import { getCachedAffiliateGoods } from '../../features/affiliate/session-cache'
import { useCampusShare } from '../../features/share'
import { setCustomTabBarHidden } from '../../utils/tabbar'
import './detail.scss'

type ProductDetail = AffiliateProduct | AffiliateGoods

const couponStatusText: Record<AffiliateGoods['coupon_status'], string> = {
  unknown: '优惠信息待核验',
  not_started: '优惠券尚未开始',
  active: '优惠券可用',
  expired: '优惠券已结束',
  sold_out: '优惠券已领完',
  none: '暂无优惠券',
}

const purchaseLabel = (couponStatus: AffiliateGoods['coupon_status']) => {
  if (couponStatus === 'active') return '领券购买'
  if (couponStatus === 'unknown' || couponStatus === 'not_started') return '查看优惠'
  return '购买商品'
}

export default function AffiliateProductDetailPage() {
  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [productId, setProductId] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [missingGoodsContext, setMissingGoodsContext] = useState(false)
  const [purchaseProduct, setPurchaseProduct] = useState<AffiliatePurchaseProduct | null>(null)

  const loadProduct = async (id: number) => {
    setLoading(true)
    setError('')
    setMissingGoodsContext(false)
    try {
      setProduct(await getAffiliateProduct(id))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '商品详情加载失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  useLoad((options) => {
    const id = Number(options.id)
    if (Number.isSafeInteger(id) && id > 0) {
      setProductId(id)
      void loadProduct(id)
      return
    }
    const goodsId = typeof options.goods_id === 'string' ? options.goods_id.trim() : ''
    if (goodsId) {
      const cachedProduct = getCachedAffiliateGoods(goodsId)
      if (cachedProduct) setProduct(cachedProduct)
      else setMissingGoodsContext(true)
      setLoading(false)
      return
    }
    setError('商品链接无效')
    setLoading(false)
  })

  useDidShow(() => setCustomTabBarHidden(true))
  useDidHide(() => setCustomTabBarHidden(false))

  useCampusShare(() => {
    if (product && 'id' in product) {
      return {
        title: product.recommendation_title || product.title,
        path: '/pages/goods/detail',
        query: { id: product.id },
        imageUrl: product.image_url || undefined,
      }
    }
    return { title: 'Campus 好物', path: '/pages/goods/index' }
  })

  const showProduct = product !== null
  const recommendationTitle = product && 'recommendation_title' in product
    ? product.recommendation_title
    : undefined
  const recommendationReason = product && 'recommendation_reason' in product
    ? product.recommendation_reason
    : undefined

  return (
    <View className='affiliate-detail'>
      <CustomNavbar title='好物详情' showBack />

      {loading && <View className='affiliate-detail__state' ariaRole='status'>正在加载商品详情…</View>}
      {!loading && error && (
        <View className='affiliate-detail__state affiliate-detail__state--error'>
          <Text>{error}</Text>
          {productId > 0 && (
            <View className='affiliate-detail__retry' ariaRole='button' onClick={() => void loadProduct(productId)}>
              重新加载
            </View>
          )}
          {productId === 0 && (
            <View
              className='affiliate-detail__retry'
              ariaRole='button'
              onClick={() => Taro.navigateTo({ url: '/pages/goods/search?mode=resolve' })}
            >
              粘贴商品链接查券
            </View>
          )}
        </View>
      )}
      {!loading && !error && missingGoodsContext && (
        <View className='affiliate-detail__state'>
          <View className='affiliate-detail__missing-icon' />
          <Text className='affiliate-detail__missing-title'>暂时无法显示这个商品详情</Text>
          <Text className='affiliate-detail__missing-note'>商品来自外部 goods_id 链接，重新粘贴淘宝商品链接后即可核验优惠。</Text>
          <View
            className='affiliate-detail__retry'
            ariaRole='button'
            onClick={() => Taro.navigateTo({ url: '/pages/goods/search?mode=resolve' })}
          >
            粘贴链接查券
          </View>
        </View>
      )}
      {!loading && !error && showProduct && product && (
        <>
          <View className='affiliate-detail__image-wrap'>
            {product.image_url ? (
              <Image className='affiliate-detail__image' src={product.image_url} mode='aspectFill' />
            ) : (
              <View className='affiliate-detail__image-placeholder' />
            )}
          </View>

          <View className='affiliate-detail__content'>
            {recommendationTitle && <Text className='affiliate-detail__eyebrow'>{recommendationTitle}</Text>}
            <Text className='affiliate-detail__title'>{product.title}</Text>
            {product.shop_name && <Text className='affiliate-detail__shop'>{product.shop_name}</Text>}
            {recommendationReason && (
              <View className='affiliate-detail__recommendation'>
                <Text className='affiliate-detail__recommendation-label'>校园推荐</Text>
                <Text className='affiliate-detail__recommendation-copy'>{recommendationReason}</Text>
              </View>
            )}

            <View className='affiliate-detail__price-card'>
              <View className='affiliate-detail__coupon-row'>
                {product.coupon_status === 'active' && product.coupon_amount ? (
                  <Text className='affiliate-detail__coupon-amount'>优惠券 ¥{product.coupon_amount}</Text>
                ) : (
                  <Text className={`affiliate-detail__coupon-status affiliate-detail__coupon-status--${product.coupon_status}`}>
                    {couponStatusText[product.coupon_status]}
                  </Text>
                )}
                {product.coupon_condition && <Text className='affiliate-detail__condition'>{product.coupon_condition}</Text>}
              </View>
              <View className='affiliate-detail__price-row'>
                <Text>参考券后价</Text>
                <Text className='affiliate-detail__actual-price'>{product.actual_price ? `¥${product.actual_price}` : '以淘宝商品页为准'}</Text>
              </View>
              {product.original_price && (
                <View className='affiliate-detail__price-row affiliate-detail__price-row--original'>
                  <Text>商品参考价</Text>
                  <Text>¥{product.original_price}</Text>
                </View>
              )}
            </View>
            <Text className='affiliate-detail__disclaimer'>商品价格和优惠以淘宝商品页面为准；下单前请核对优惠条件。</Text>
          </View>

          <View className='affiliate-detail__footer'>
            <View
              className={`affiliate-detail__buy ${product.availability !== 'valid' ? 'affiliate-detail__buy--disabled' : ''}`}
              ariaRole='button'
              ariaLabel={product.availability === 'valid' ? '领券购买商品' : '商品暂不可购买'}
              onClick={() => {
                if (product.availability === 'valid') setPurchaseProduct(product)
              }}
            >
              {product.availability === 'valid'
                ? purchaseLabel(product.coupon_status)
                : '商品暂不可购买'}
            </View>
          </View>
        </>
      )}

      {purchaseProduct && (
        <CouponPurchaseSheet product={purchaseProduct} onClose={() => setPurchaseProduct(null)} />
      )}
    </View>
  )
}
