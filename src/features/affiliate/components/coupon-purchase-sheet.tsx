import { useEffect, useRef, useState } from 'react'
import Taro, { showToast } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import BottomSheet from '../../../components/bottom-sheet'
import { convertAffiliateGoods, type AffiliateConvertResult } from '../../../api/affiliate'
import { hasAffiliateOfferChanged, isAffiliateLinkExpired } from '../purchase-policy'
import type { AffiliatePurchaseProduct } from './product-card'
import './coupon-purchase-sheet.scss'

type CouponPurchaseSheetProps = {
  product: AffiliatePurchaseProduct | null
  onClose: () => void
}

const convertStatusLabels: Record<AffiliateConvertResult['coupon_status'], string> = {
  unknown: '优惠信息待核验',
  not_started: '优惠券尚未开始',
  active: '优惠券可领取',
  expired: '优惠券已结束',
  sold_out: '优惠券已领完',
  none: '当前商品暂无优惠券',
}

const formatExpireTime = (value: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${month}-${day} ${hour}:${minute} 后需重新核验优惠`
}

export default function CouponPurchaseSheet({ product, onClose }: CouponPurchaseSheetProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AffiliateConvertResult | null>(null)
  const [error, setError] = useState('')
  const [refreshConfirmationRequired, setRefreshConfirmationRequired] = useState(false)
  const requestRevision = useRef(0)
  const currentGoodsId = product?.goods_id

  const convert = async (goodsId: string): Promise<AffiliateConvertResult | null> => {
    const revision = requestRevision.current + 1
    requestRevision.current = revision
    setLoading(true)
    setError('')
    setResult(null)
    setRefreshConfirmationRequired(false)
    try {
      const response = await convertAffiliateGoods(goodsId)
      if (requestRevision.current === revision) setResult(response)
      return response
    } catch (convertError) {
      if (requestRevision.current === revision) {
        setError(convertError instanceof Error ? convertError.message : '生成推广链接失败，请稍后重试')
      }
      return null
    } finally {
      if (requestRevision.current === revision) setLoading(false)
    }
  }

  useEffect(() => {
    if (!currentGoodsId) return undefined
    void convert(currentGoodsId)
    return () => { requestRevision.current += 1 }
  }, [currentGoodsId])

  const copyConvertedLink = async () => {
    if (!result || loading || !product) return
    if (isAffiliateLinkExpired(result.expires_at)) {
      const refreshed = await convert(product.goods_id)
      if (!refreshed) return
      if (isAffiliateLinkExpired(refreshed.expires_at)) {
        showToast({ title: '新推广链接已过期，请稍后重试', icon: 'none' })
        return
      }
      setRefreshConfirmationRequired(true)
      showToast({ title: '优惠已刷新，请确认后复制', icon: 'none' })
      return
    }

    if (refreshConfirmationRequired || hasAffiliateOfferChanged(product, result)) {
      try {
        const confirmation = await Taro.showModal({
          title: '优惠信息已更新',
          content: '优惠信息已更新，请确认后复制。',
          confirmText: '确认并复制',
          cancelText: '取消',
        })
        if (!confirmation.confirm) return
      } catch {
        showToast({ title: '请确认当前优惠信息后再复制', icon: 'none' })
        return
      }
    }

    const clipboardText = result.taobao_password || result.coupon_url || result.share_url
    if (!clipboardText) {
      showToast({ title: '暂时没有可复制的推广链接', icon: 'none' })
      return
    }
    try {
      await Taro.setClipboardData({ data: clipboardText })
      showToast({ title: result.taobao_password ? '淘口令已复制' : '购买链接已复制', icon: 'success' })
      onClose()
    } catch {
      showToast({ title: '复制失败，请重试', icon: 'none' })
    }
  }

  if (!product) return null

  return (
    <BottomSheet
      visible
      title='优惠与购买'
      onClose={onClose}
      footer={(
        <View
          className={`coupon-purchase-sheet__primary ${!result || loading ? 'coupon-purchase-sheet__primary--disabled' : ''}`}
          ariaRole='button'
          ariaLabel={result
            ? hasAffiliateOfferChanged(product, result) || refreshConfirmationRequired
              ? '确认优惠信息后复制推广口令或链接'
              : '复制推广口令或链接'
            : '推广链接暂不可用'}
          onClick={() => void copyConvertedLink()}
        >
          {result?.taobao_password ? '复制淘口令' : '复制购买链接'}
        </View>
      )}
    >
      <View className='coupon-purchase-sheet'>
        <Text className='coupon-purchase-sheet__title'>{product.title}</Text>
        {product.shop_name && <Text className='coupon-purchase-sheet__shop'>{product.shop_name}</Text>}

        {loading && (
          <View className='coupon-purchase-sheet__state' ariaRole='status'>正在生成推广链接…</View>
        )}
        {error && (
          <View className='coupon-purchase-sheet__error'>
            <Text>{error}</Text>
            <View
              className='coupon-purchase-sheet__retry'
              ariaRole='button'
              onClick={() => void convert(product.goods_id)}
            >
              重试
            </View>
          </View>
        )}
        {result && (
          <View className='coupon-purchase-sheet__result'>
            {(refreshConfirmationRequired || hasAffiliateOfferChanged(product, result)) && (
              <View className='coupon-purchase-sheet__updated' ariaRole='status'>优惠信息已更新，请确认后复制。</View>
            )}
            <View className='coupon-purchase-sheet__coupon'>
              <Text className='coupon-purchase-sheet__coupon-label'>{convertStatusLabels[result.coupon_status]}</Text>
              {result.coupon_amount && result.coupon_status === 'active' && (
                <Text className='coupon-purchase-sheet__coupon-amount'>¥{result.coupon_amount}</Text>
              )}
              {result.coupon_condition && (
                <Text className='coupon-purchase-sheet__condition'>{result.coupon_condition}</Text>
              )}
            </View>
            <View className='coupon-purchase-sheet__price-row'>
              <Text>参考券后价</Text>
              <Text className='coupon-purchase-sheet__price'>
                {result.actual_price ? `¥${result.actual_price}` : '以淘宝商品页为准'}
              </Text>
            </View>
            {formatExpireTime(result.expires_at) && (
              <Text className='coupon-purchase-sheet__expires'>{formatExpireTime(result.expires_at)}</Text>
            )}
            <Text className='coupon-purchase-sheet__hint'>打开淘宝后按页面提示领取优惠并下单</Text>
          </View>
        )}
      </View>
    </BottomSheet>
  )
}
