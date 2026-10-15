import { useCallback, useEffect, useRef, useState } from 'react'
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
import {
  applyAffiliateRequestIfCurrent,
  canUseAffiliateCapability,
} from '../../features/affiliate/capability-policy'
import {
  getAffiliateCapabilitySnapshot,
  refreshAffiliateCapabilities,
} from '../../features/affiliate/capabilities'
import { useAffiliateCapabilities } from '../../features/affiliate/use-capabilities'
import { createAffiliateImageFallbackState } from '../../features/affiliate/image-fallback'
import { getAffiliateProductDetailMetadata } from '../../features/affiliate/detail-metadata'
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
  const capabilitySnapshot = useAffiliateCapabilities()
  const capabilities = capabilitySnapshot.capabilities
  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [route, setRoute] = useState<{ id: number; goodsId: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [missingGoodsContext, setMissingGoodsContext] = useState(false)
  const [purchaseProduct, setPurchaseProduct] = useState<AffiliatePurchaseProduct | null>(null)
  const [imageFallback] = useState(createAffiliateImageFallbackState)
  const [, setImageRenderRevision] = useState(0)
  const requestRevision = useRef(0)

  const loadProduct = useCallback(async (id: number) => {
    const revision = requestRevision.current + 1
    requestRevision.current = revision
    const capabilityRevision = getAffiliateCapabilitySnapshot().revision
    setLoading(true)
    setError('')
    setMissingGoodsContext(false)
    try {
      const result = await getAffiliateProduct(id)
      const latest = getAffiliateCapabilitySnapshot()
      applyAffiliateRequestIfCurrent(
        requestRevision.current,
        revision,
        latest.revision,
        capabilityRevision,
        latest.capabilities,
        () => setProduct(result),
      )
    } catch (loadError) {
      const latest = getAffiliateCapabilitySnapshot()
      applyAffiliateRequestIfCurrent(
        requestRevision.current,
        revision,
        latest.revision,
        capabilityRevision,
        latest.capabilities,
        () => setError(loadError instanceof Error ? loadError.message : '商品详情加载失败，请稍后重试'),
      )
    } finally {
      const latest = getAffiliateCapabilitySnapshot()
      applyAffiliateRequestIfCurrent(
        requestRevision.current,
        revision,
        latest.revision,
        capabilityRevision,
        latest.capabilities,
        () => setLoading(false),
      )
    }
  }, [])

  useLoad((options) => {
    const id = Number(options.id)
    if (Number.isSafeInteger(id) && id > 0) {
      setRoute({ id, goodsId: '' })
      return
    }
    const rawGoodsId = typeof options.goods_id === 'string' ? options.goods_id : ''
    const goodsId = rawGoodsId.trim() ? rawGoodsId : ''
    setRoute({ id: 0, goodsId })
  })

  useEffect(() => {
    if (!route || !capabilitySnapshot.loaded) return
    if (!capabilities.enabled) {
      requestRevision.current += 1
      setProduct(null)
      setPurchaseProduct(null)
      setError('')
      setMissingGoodsContext(false)
      setLoading(false)
      return
    }
    if (route.id > 0) {
      void loadProduct(route.id)
      return () => { requestRevision.current += 1 }
    }
    if (route.goodsId) {
      requestRevision.current += 1
      const cachedProduct = getCachedAffiliateGoods(route.goodsId)
      if (cachedProduct) {
        setProduct(cachedProduct)
        setMissingGoodsContext(false)
      } else {
        setProduct(null)
        setMissingGoodsContext(true)
      }
      setError('')
      setLoading(false)
      return () => { requestRevision.current += 1 }
    }
    requestRevision.current += 1
    setError('商品链接无效')
    setLoading(false)
    return () => { requestRevision.current += 1 }
  }, [capabilitySnapshot.loaded, capabilitySnapshot.revision, capabilities.enabled, loadProduct, route])

  useDidShow(() => {
    setCustomTabBarHidden(true)
    void refreshAffiliateCapabilities()
  })
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
  const convertEnabled = canUseAffiliateCapability(capabilities, 'convert')
  const resolveEnabled = canUseAffiliateCapability(capabilities, 'resolve')
  const recommendationTitle = product && 'recommendation_title' in product
    ? product.recommendation_title
    : undefined
  const recommendationReason = product && 'recommendation_reason' in product
    ? product.recommendation_reason
    : undefined
  const imageSourceKey = product
    ? `${'id' in product ? `product:${product.id}` : `goods:${product.goods_id}`}|${product.image_url || ''}`
    : ''
  const imageToken = imageFallback.select(imageSourceKey)
  const detailMetadata = product ? getAffiliateProductDetailMetadata(product) : []

  return (
    <View className='affiliate-detail'>
      <CustomNavbar title='好物详情' showBack />

      {!capabilitySnapshot.loaded && (
        <View className='affiliate-detail__state' ariaRole='status'>正在检查好物服务…</View>
      )}
      {capabilitySnapshot.loaded && !capabilities.enabled && (
        <View className='affiliate-detail__state'>
          <Text className='affiliate-detail__missing-title'>好物服务暂时关闭</Text>
          <Text className='affiliate-detail__missing-note'>当前无法查询优惠或生成推广链接，请稍后再试。</Text>
        </View>
      )}
      {capabilitySnapshot.loaded && capabilities.enabled && <>
      {loading && <View className='affiliate-detail__state' ariaRole='status'>正在加载商品详情…</View>}
      {!loading && error && (
        <View className='affiliate-detail__state affiliate-detail__state--error'>
          <Text>{error}</Text>
          {route?.id && route.id > 0 && (
            <View className='affiliate-detail__retry' ariaRole='button' onClick={() => void loadProduct(route.id)}>
              重新加载
            </View>
          )}
          {route?.id === 0 && resolveEnabled && (
            <View
              className='affiliate-detail__retry'
              ariaRole='button'
              onClick={() => Taro.navigateTo({ url: '/pages/goods/search?mode=resolve' })}
            >
              粘贴商品链接查券
            </View>
          )}
          {route?.id === 0 && !resolveEnabled && <Text>链接解析功能暂不可用。</Text>}
        </View>
      )}
      {!loading && !error && missingGoodsContext && (
        <View className='affiliate-detail__state'>
          <View className='affiliate-detail__missing-icon' />
          <Text className='affiliate-detail__missing-title'>暂时无法显示这个商品详情</Text>
          <Text className='affiliate-detail__missing-note'>商品来自外部 goods_id 链接，重新粘贴淘宝商品链接后即可核验优惠。</Text>
          {resolveEnabled ? <View
            className='affiliate-detail__retry'
            ariaRole='button'
            onClick={() => Taro.navigateTo({ url: '/pages/goods/search?mode=resolve' })}
          >
            粘贴链接查券
          </View> : <Text>链接解析功能暂不可用。</Text>}
        </View>
      )}
      {!loading && !error && showProduct && product && (
        <>
          <View className='affiliate-detail__image-wrap'>
            {product.image_url ? (
              !imageFallback.isFailed(imageToken) ? (
                <Image
                  key={imageToken}
                  className='affiliate-detail__image'
                  src={product.image_url}
                  mode='aspectFill'
                  onError={() => {
                    if (imageFallback.markFailed(imageToken)) {
                      setImageRenderRevision((revision) => revision + 1)
                    }
                  }}
                />
              ) : (
                <View className='affiliate-detail__image-placeholder' />
              )
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
              {detailMetadata.map((item) => (
                <View className='affiliate-detail__metadata-row' key={item.key}>
                  <Text>{item.label}</Text>
                  <Text>{item.value}</Text>
                </View>
              ))}
            </View>
            <Text className='affiliate-detail__disclaimer'>商品价格和优惠以淘宝商品页面为准；下单前请核对优惠条件。</Text>
          </View>

          <View className='affiliate-detail__footer'>
            <View
              className={`affiliate-detail__buy ${!convertEnabled || product.availability !== 'valid' ? 'affiliate-detail__buy--disabled' : ''}`}
              ariaRole='button'
              ariaLabel={!convertEnabled ? '推广购买暂不可用' : product.availability === 'valid' ? '领券购买商品' : '商品暂不可购买'}
              onClick={() => {
                if (convertEnabled && product.availability === 'valid') setPurchaseProduct(product)
              }}
            >
              {!convertEnabled
                ? '推广暂不可用'
                : product.availability === 'valid'
                ? purchaseLabel(product.coupon_status)
                : '商品暂不可购买'}
            </View>
          </View>
        </>
      )}

      {purchaseProduct && (
        <CouponPurchaseSheet product={purchaseProduct} onClose={() => setPurchaseProduct(null)} />
      )}
      </>}
    </View>
  )
}
