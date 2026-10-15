import { useEffect, useRef, useState } from 'react'
import Taro, { showToast } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import BottomSheet from '../../../components/bottom-sheet'
import { convertAffiliateGoods, type AffiliateConvertResult } from '../../../api/affiliate'
import {
  canUseAffiliateCapability,
  isCurrentAffiliateCopyOperation,
  runAffiliateCopyIfCurrent,
  type AffiliateCopyOperationIdentity,
} from '../capability-policy'
import {
  hasAffiliateOfferChanged,
  runAffiliatePurchaseCopyWorkflow,
} from '../purchase-policy'
import {
  getAffiliateCapabilitySnapshot,
  refreshAffiliateCapabilities,
} from '../capabilities'
import { useAffiliateCapabilities } from '../use-capabilities'
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
  const capabilitySnapshot = useAffiliateCapabilities()
  const convertEnabled = canUseAffiliateCapability(capabilitySnapshot.capabilities, 'convert')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AffiliateConvertResult | null>(null)
  const [error, setError] = useState('')
  const [refreshConfirmationRequired, setRefreshConfirmationRequired] = useState(false)
  const requestRevision = useRef(0)
  const currentGoodsId = product?.goods_id
  const currentGoodsIdRef = useRef<string | undefined>(currentGoodsId)
  currentGoodsIdRef.current = currentGoodsId

  const getCurrentCopyIdentity = () => {
    const latest = getAffiliateCapabilitySnapshot()
    return {
      identity: {
        requestRevision: requestRevision.current,
        capabilityRevision: latest.revision,
        goodsId: currentGoodsIdRef.current,
      },
      capabilities: latest.capabilities,
    }
  }

  const isCurrentCopyOperation = (captured: AffiliateCopyOperationIdentity) => {
    const latest = getCurrentCopyIdentity()
    return isCurrentAffiliateCopyOperation(
      latest.identity,
      captured,
      latest.capabilities,
    )
  }

  const convert = async (goodsId: string): Promise<AffiliateConvertResult | null> => {
    const revision = requestRevision.current + 1
    requestRevision.current = revision
    setLoading(true)
    setError('')
    setResult(null)
    setRefreshConfirmationRequired(false)
    try {
      const latestCapabilities = await refreshAffiliateCapabilities()
      if (!canUseAffiliateCapability(latestCapabilities.capabilities, 'convert')) {
        if (requestRevision.current === revision) {
          setError('推广购买功能暂不可用，请稍后再试。')
        }
        return null
      }
      const response = await convertAffiliateGoods(goodsId)
      if (requestRevision.current === revision
        && getAffiliateCapabilitySnapshot().capabilities.convert_enabled) setResult(response)
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
    if (!currentGoodsId || !capabilitySnapshot.loaded) return undefined
    if (!convertEnabled) {
      requestRevision.current += 1
      setLoading(false)
      setResult(null)
      setError('推广购买功能暂不可用，请稍后再试。')
      setRefreshConfirmationRequired(false)
      return undefined
    }
    void convert(currentGoodsId)
    return () => { requestRevision.current += 1 }
  }, [capabilitySnapshot.loaded, capabilitySnapshot.revision, convertEnabled, currentGoodsId])

  const copyConvertedLink = async () => {
    if (!result || loading || !product) return
    const capturedResult = result
    const capturedProduct = product
    const capturedGoodsId = product.goods_id
    const capturedCapabilityRevision = getAffiliateCapabilitySnapshot().revision
    let capturedRequestRevision = requestRevision.current
    const capturedIdentity = (): AffiliateCopyOperationIdentity => ({
      requestRevision: capturedRequestRevision,
      capabilityRevision: capturedCapabilityRevision,
      goodsId: capturedGoodsId,
    })

    await refreshAffiliateCapabilities()
    if (!isCurrentCopyOperation(capturedIdentity())) return

    try {
      const outcome = await runAffiliatePurchaseCopyWorkflow({
        result: capturedResult,
        requiresConfirmation: refreshConfirmationRequired || hasAffiliateOfferChanged(capturedProduct, capturedResult),
        isCurrent: () => isCurrentCopyOperation(capturedIdentity()),
        confirm: async () => {
          try {
            const confirmation = await Taro.showModal({
              title: '优惠信息已更新',
              content: '优惠信息已更新，请确认后复制。',
              confirmText: '确认并复制',
              cancelText: '取消',
            })
            return confirmation.confirm
          } catch {
            if (isCurrentCopyOperation(capturedIdentity())) {
              showToast({ title: '请确认当前优惠信息后再复制', icon: 'none' })
            }
            return false
          }
        },
        refresh: async () => {
          const refreshedRequest = convert(capturedGoodsId)
          capturedRequestRevision = requestRevision.current
          const refreshed = await refreshedRequest
          return refreshed && isCurrentCopyOperation(capturedIdentity()) ? refreshed : null
        },
        onRefreshed: () => {
          setRefreshConfirmationRequired(true)
          showToast({ title: '优惠已刷新，请确认后复制', icon: 'none' })
        },
        onRefreshExpired: () => showToast({ title: '新推广链接已过期，请稍后重试', icon: 'none' }),
        copy: async (copyResult) => {
          const clipboardText = copyResult.taobao_password || copyResult.coupon_url || copyResult.share_url
          if (!clipboardText) {
            showToast({ title: '暂时没有可复制的推广链接', icon: 'none' })
            return false
          }
          const latest = getCurrentCopyIdentity()
          const clipboardOperation = runAffiliateCopyIfCurrent(
            latest.identity,
            capturedIdentity(),
            latest.capabilities,
            () => Taro.setClipboardData({ data: clipboardText }),
          )
          if (!clipboardOperation) return false
          await clipboardOperation
          return isCurrentCopyOperation(capturedIdentity())
        },
      })
      if (outcome === 'copied' && isCurrentCopyOperation(capturedIdentity())) {
        showToast({ title: capturedResult.taobao_password ? '淘口令已复制' : '购买链接已复制', icon: 'success' })
        onClose()
      }
    } catch {
      if (isCurrentCopyOperation(capturedIdentity())) {
        showToast({ title: '复制失败，请重试', icon: 'none' })
      }
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
          className={`coupon-purchase-sheet__primary ${!result || loading || !convertEnabled ? 'coupon-purchase-sheet__primary--disabled' : ''}`}
          ariaRole='button'
          ariaLabel={result
            ? !convertEnabled
              ? '推广购买暂不可用'
              : hasAffiliateOfferChanged(product, result) || refreshConfirmationRequired
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

        {capabilitySnapshot.loaded && !convertEnabled && (
          <View className='coupon-purchase-sheet__error' ariaRole='status'>推广购买功能暂不可用，请稍后再试。</View>
        )}

        {loading && (
          <View className='coupon-purchase-sheet__state' ariaRole='status'>正在生成推广链接…</View>
        )}
        {error && convertEnabled && (
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
        {result && convertEnabled && (
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
