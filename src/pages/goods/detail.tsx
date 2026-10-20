import { useCallback, useEffect, useRef, useState } from 'react'
import Taro, { useDidHide, useDidShow, useLoad } from '@tarojs/taro'
import { Button, Image, Text, View } from '@tarojs/components'
import {
  getAffiliateProduct,
  type AffiliateGoods,
  type AffiliateProduct,
} from '../../api/affiliate'
import CustomNavbar from '../../components/custom-navbar'
import type { AffiliatePurchaseProduct } from '../../features/affiliate/components/product-card'
import CouponPurchaseSheet from '../../features/affiliate/components/coupon-purchase-sheet'
import { getCachedAffiliateGoods } from '../../features/affiliate/session-cache'
import type { AffiliateResolutionGoods } from '../../features/affiliate/resolution-ticket'
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
import {
  getAffiliateProductDetailSourceMetadata,
} from '../../features/affiliate/detail-source-metadata'
import {
  getAffiliateCouponStatusForDisplay,
  getAffiliateCouponTimeRange,
  getAffiliateReferencePrice,
  getAffiliatePurchaseLabel,
  getAffiliatePromotionDisplay,
  hasCurrentAffiliateCoupon,
  useAffiliateOfferClock,
  type AffiliateOfferData,
} from '../../features/affiliate/promotions'
import { useCampusShare } from '../../features/share'
import { setCustomTabBarHidden } from '../../utils/tabbar'
import goodsIcon from '../../assets/tabbar/goods.svg'
import shareIcon from '../../assets/community/share.svg'
import './detail.scss'

type ProductDetail = AffiliateProduct | AffiliateResolutionGoods

const couponStatusText: Record<AffiliateGoods['coupon_status'], string> = {
  unknown: '优惠信息待核验',
  not_started: '优惠券尚未开始',
  active: '优惠信息待核验',
  expired: '优惠券已结束',
  sold_out: '优惠券已领完',
  none: '暂无优惠券',
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
  const [offerClockRevision, setOfferClockRevision] = useState(0)
  const [, setImageRenderRevision] = useState(0)
  const requestRevision = useRef(0)
  const offerNow = useAffiliateOfferClock(product as AffiliateOfferData | null, offerClockRevision)
  const offer = product as AffiliateOfferData | null
  const activeCoupon = offer ? hasCurrentAffiliateCoupon(offer, offerNow) : false
  const couponStatus = offer ? getAffiliateCouponStatusForDisplay(offer, offerNow) : 'unknown'
  const promotion = offer ? getAffiliatePromotionDisplay(offer.promotion, offerNow) : null
  const couponTimeRange = offer ? getAffiliateCouponTimeRange(offer, offerNow) : null
  const referencePrice = product && offer
    ? getAffiliateReferencePrice(offer, product.actual_price, product.original_price, offerNow)
    : null

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
    setOfferClockRevision((revision) => revision + 1)
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
  const detailMetadata = product
    ? getAffiliateProductDetailMetadata(product).filter((item) => !(activeCoupon && item.key === 'coupon_end_at'))
    : []
  const sourceMetadata = product ? getAffiliateProductDetailSourceMetadata(product) : null
  const offerPurchaseLabel = getAffiliatePurchaseLabel(activeCoupon, Boolean(promotion), couponStatus)
  const resolutionTokenMissing = product
    && 'requires_resolution_token' in product
    && product.requires_resolution_token === true
    && (typeof product.resolution_token !== 'string' || !product.resolution_token.trim())

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
                  mode='aspectFit'
                  ariaLabel='查看完整商品图片'
                  onClick={() => {
                    void Taro.previewImage({ urls: [product.image_url!], current: product.image_url! })
                      .catch(() => Taro.showToast({ title: '图片暂时无法预览', icon: 'none' }))
                  }}
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
            {product.image_url && !imageFallback.isFailed(imageToken) && (
              <Text className='affiliate-detail__image-hint'>点击查看大图</Text>
            )}
          </View>

          <View className='affiliate-detail__content'>
            <View className='affiliate-detail__price-card'>
              {promotion && <View className='affiliate-detail__campaign-line'><Text>{promotion.title}</Text></View>}
              <View className='affiliate-detail__price-heading'>
                <View className='affiliate-detail__price-row'>
                  <Text>{referencePrice?.isCouponPrice ? '参考券后价' : promotion ? '活动参考价' : '商品参考价'}</Text>
                  <View className='affiliate-detail__price-values'>
                    <Text className={`affiliate-detail__actual-price ${!referencePrice?.value ? 'affiliate-detail__actual-price--unknown' : ''}`}>{referencePrice?.value ? <><Text className='affiliate-detail__currency'>¥</Text>{referencePrice.value.split('.')[0]}<Text className='affiliate-detail__decimal'>{referencePrice.value.includes('.') ? `.${referencePrice.value.split('.')[1]}` : ''}</Text></> : '以淘宝商品页为准'}</Text>
                    {referencePrice?.canStrikeOriginalPrice && product.original_price && (
                      <Text className='affiliate-detail__original-price'>¥{product.original_price}</Text>
                    )}
                  </View>
                </View>
              </View>
            </View>
            <View className='affiliate-detail__info-card'>
              {(activeCoupon || (!promotion && couponStatus !== 'none')) && (
                <View className='affiliate-detail__benefits'>
                  <View className='affiliate-detail__coupon-row'>
                    {activeCoupon && product.coupon_amount ? (
                      <View className='affiliate-detail__coupon-offer'>
                        <Text className='affiliate-detail__coupon-lead'>可领券</Text>
                        <Text className='affiliate-detail__coupon-amount'>¥{product.coupon_amount} 优惠券</Text>
                      </View>
                    ) : (
                      <Text className={`affiliate-detail__coupon-status affiliate-detail__coupon-status--${couponStatus}`}>
                        {couponStatusText[couponStatus]}
                      </Text>
                    )}
                    {activeCoupon && product.coupon_condition && (
                      <Text className='affiliate-detail__condition'>{product.coupon_condition}</Text>
                    )}
                  </View>
                </View>
              )}
              {recommendationTitle && <Text className='affiliate-detail__eyebrow'>{recommendationTitle}</Text>}
              <Text className='affiliate-detail__title'>{product.title}</Text>
              {sourceMetadata && sourceMetadata.specialTexts.length > 0 && (
                <View className='affiliate-detail__special-section'>
                  <View className='affiliate-detail__special-tags'>
                    {sourceMetadata.specialTexts.map((specialText, index) => (
                      <Text className='affiliate-detail__special-tag' key={`${specialText}-${index}`}>
                        {specialText}
                      </Text>
                    ))}
                  </View>
                </View>
              )}
              {product.shop_name && <View className='affiliate-detail__shop'><Image className='affiliate-detail__shop-icon' src={goodsIcon} mode='aspectFit' /><Text>{product.shop_name}</Text></View>}
              {sourceMetadata && sourceMetadata.badges.length > 0 && (
                <View className='affiliate-detail__source-badges'>
                  {sourceMetadata.badges.map((badge) => (
                    <Text className='affiliate-detail__source-badge' key={badge.key}>{badge.label}</Text>
                  ))}
                </View>
              )}
              {recommendationReason && (
                <View className='affiliate-detail__recommendation'>
                  <Text className='affiliate-detail__recommendation-label'>推荐理由</Text>
                  <Text className='affiliate-detail__recommendation-copy'>{recommendationReason}</Text>
                </View>
              )}

            </View>
            {sourceMetadata?.recommendationText && (
              <View className='affiliate-detail__source-copy'>
                <Text className='affiliate-detail__source-copy-title'>商品推荐</Text>
                <Text className='affiliate-detail__source-copy-text'>{sourceMetadata.recommendationText}</Text>
                <Text className='affiliate-detail__source-copy-note'>商家推广信息，优惠条件以淘宝商品页为准</Text>
              </View>
            )}
            <View className='affiliate-detail__notice-card'>
              <Text className='affiliate-detail__notice-title'>优惠说明</Text>
              {activeCoupon && couponTimeRange && (
                <View className='affiliate-detail__coupon-time'>
                  <Text>优惠券时间</Text>
                  <Text className='affiliate-detail__coupon-time-value'>{couponTimeRange}</Text>
                </View>
              )}
              {detailMetadata.filter((item) => item.key !== 'snapshot_at').map((item) => <Text className='affiliate-detail__disclaimer' key={item.key}>{item.label}：{item.value}</Text>)}
              {promotion && <Text className='affiliate-detail__disclaimer'>{promotion.typeLabel} · {promotion.discountLabel || promotion.title} · {promotion.timeRange}</Text>}
              {detailMetadata.filter((item) => item.key === 'snapshot_at').map((item) => <Text className='affiliate-detail__disclaimer' key={item.key}>{item.label}：{item.value}</Text>)}
              <Text className='affiliate-detail__disclaimer'>商品价格和优惠以淘宝商品页面为准；下单前请核对优惠条件。</Text>
              <Text className='affiliate-detail__disclaimer'>点击购买后可按指引复制口令或链接，在淘宝完成购买。</Text>
            </View>
          </View>

          <View className='affiliate-detail__footer'>
            <View className='affiliate-detail__tools'>
              <View className='affiliate-detail__tool' ariaRole='button' ariaLabel='返回好物列表'
                onClick={() => { void Taro.switchTab({ url: '/pages/goods/index' }) }}
              >
                <Image src={goodsIcon} className='affiliate-detail__tool-icon' mode='aspectFit' />
                <Text>好物</Text>
              </View>
              <Button className='affiliate-detail__tool affiliate-detail__share' hoverClass='none' openType='share' ariaLabel='分享商品'>
                <Image src={shareIcon} className='affiliate-detail__tool-icon' mode='aspectFit' />
                <Text>分享</Text>
              </Button>
            </View>
            <View
              className={`affiliate-detail__buy ${!convertEnabled || product.availability !== 'valid' ? 'affiliate-detail__buy--disabled' : ''}`}
              ariaRole='button'
              ariaLabel={!convertEnabled
                ? '推广购买暂不可用'
                : resolutionTokenMissing
                ? '解析凭证不可用，重新解析后购买'
                : product.availability === 'valid' ? `${offerPurchaseLabel}商品` : '商品暂不可购买'}
              onClick={() => {
                if (convertEnabled && product.availability === 'valid') setPurchaseProduct(product)
              }}
            >
              {!convertEnabled
                ? '推广暂不可用'
                : resolutionTokenMissing
                ? '重新解析'
                : product.availability === 'valid'
                ? offerPurchaseLabel
                : '商品暂不可购买'}
            </View>
          </View>
        </>
      )}

      {purchaseProduct && (
        <CouponPurchaseSheet
          product={purchaseProduct}
          onClose={() => setPurchaseProduct(null)}
          onRepaste={() => {
            setPurchaseProduct(null)
            Taro.navigateTo({ url: '/pages/goods/search?mode=resolve' })
          }}
          onResolutionTokenInvalid={() => {
            const invalidToken = purchaseProduct.resolution_token
            if (!invalidToken) return
            setProduct((current) => current
              && current.goods_id === purchaseProduct.goods_id
              && 'resolution_token' in current
              && current.resolution_token === invalidToken
              ? { ...current, resolution_token: undefined, requires_resolution_token: true }
              : current)
          }}
        />
      )}
      </>}
    </View>
  )
}
