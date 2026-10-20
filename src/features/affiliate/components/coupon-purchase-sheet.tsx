import { useCallback, useEffect, useRef, useState } from 'react'
import Taro, { showToast } from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import BottomSheet from '../../../components/bottom-sheet'
import {
  convertAffiliateGoods,
  convertAffiliateResolution,
  type AffiliateConvertResult,
} from '../../../api/affiliate'
import {
  canUseAffiliateCapability,
  isCurrentAffiliateCopyOperation,
  runAffiliateCopyIfCurrent,
  type AffiliateCopyOperationIdentity,
} from '../capability-policy'
import {
  isAffiliateCopyFallbackUsable,
  isAffiliateLinkExpired,
  hasAffiliateOfferChanged,
  createAffiliateCopyOperationLock,
  runAffiliateCopyOperationExclusive,
  runAffiliateConversionAfterRefresh,
  runAffiliatePurchaseCopyWorkflow,
  type AffiliateCopySessionIdentity,
  type AffiliateCopyFallback,
} from '../purchase-policy'
import {
  getAffiliateCapabilitySnapshot,
  refreshAffiliateCapabilities,
} from '../capabilities'
import { useAffiliateCapabilities } from '../use-capabilities'
import type { AffiliatePurchaseProduct } from './product-card'
import {
  getAffiliateConversionDisplay,
  getAffiliatePromotionDisplay,
  useAffiliateOfferClock,
  type AffiliateOfferData,
} from '../promotions'
import {
  getAffiliateResolutionTicketFailure,
  getAffiliateResolutionTicketMessage,
  type AffiliateResolutionTicketFailure,
} from '../resolution-ticket'
import { clearAffiliateGoodsResolutionToken } from '../session-cache'
import './coupon-purchase-sheet.scss'

type CouponPurchaseSheetProps = {
  product: AffiliatePurchaseProduct | null
  onClose: () => void
  onRepaste?: () => void
  onResolutionTokenInvalid?: () => void
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
  return `${month}-${day} ${hour}:${minute} 后需重新生成推广信息`
}

export default function CouponPurchaseSheet({ product, onClose, onRepaste, onResolutionTokenInvalid }: CouponPurchaseSheetProps) {
  const capabilitySnapshot = useAffiliateCapabilities()
  const convertEnabled = canUseAffiliateCapability(capabilitySnapshot.capabilities, 'convert')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AffiliateConvertResult | null>(null)
  const [error, setError] = useState('')
  const [resolutionTicketFailure, setResolutionTicketFailure] = useState<AffiliateResolutionTicketFailure | 'missing' | null>(null)
  const [refreshConfirmationRequired, setRefreshConfirmationRequired] = useState(false)
  const [copyFallback, setCopyFallback] = useState<AffiliateCopyFallback | null>(null)
  const requestRevision = useRef(0)
  const offer = product as AffiliateOfferData | null
  const clockOffer = offer && result?.expires_at
    ? { ...offer, coupon_end_at: result.expires_at }
    : offer
  const offerNow = useAffiliateOfferClock(clockOffer, result?.expires_at ?? undefined)
  const promotion = getAffiliatePromotionDisplay(offer?.promotion, offerNow)
  const convertedDisplay = result && product
    ? getAffiliateConversionDisplay(result, product.original_price, promotion, offerNow)
    : null
  const currentGoodsId = product?.goods_id
  const currentResolutionToken = product?.resolution_token
  const requiresResolutionToken = product?.requires_resolution_token === true
  const currentGoodsIdRef = useRef<string | undefined>(currentGoodsId)
  const currentResolutionTokenRef = useRef<string | null | undefined>(currentResolutionToken)
  const requiresResolutionTokenRef = useRef(requiresResolutionToken)
  const onResolutionTokenInvalidRef = useRef(onResolutionTokenInvalid)
  currentGoodsIdRef.current = currentGoodsId
  currentResolutionTokenRef.current = currentResolutionToken
  requiresResolutionTokenRef.current = requiresResolutionToken
  onResolutionTokenInvalidRef.current = onResolutionTokenInvalid
  const copySessionRef = useRef<AffiliateCopySessionIdentity>({
    generation: 0,
    goodsId: currentGoodsId,
    capabilityRevision: getAffiliateCapabilitySnapshot().revision,
    resolutionToken: currentResolutionToken,
    requiresResolutionToken,
  })
  const copyOperationLockRef = useRef(createAffiliateCopyOperationLock())
  const [copyInFlightSession, setCopyInFlightSession] = useState<AffiliateCopySessionIdentity | null>(null)

  const getCurrentCopySession = (): AffiliateCopySessionIdentity => {
    const latestRevision = getAffiliateCapabilitySnapshot().revision
    const previous = copySessionRef.current
    if (previous.goodsId !== currentGoodsIdRef.current
      || previous.capabilityRevision !== latestRevision
      || previous.resolutionToken !== currentResolutionTokenRef.current
      || previous.requiresResolutionToken !== requiresResolutionTokenRef.current) {
      copySessionRef.current = {
        generation: previous.generation + 1,
        goodsId: currentGoodsIdRef.current,
        capabilityRevision: latestRevision,
        resolutionToken: currentResolutionTokenRef.current,
        requiresResolutionToken: requiresResolutionTokenRef.current,
      }
    }
    return copySessionRef.current
  }

  const isCurrentCopySession = (captured: AffiliateCopySessionIdentity) => {
    const current = getCurrentCopySession()
    return current.generation === captured.generation
      && current.goodsId === captured.goodsId
      && current.resolutionToken === captured.resolutionToken
      && current.requiresResolutionToken === captured.requiresResolutionToken
      && current.capabilityRevision === captured.capabilityRevision
      && current.goodsId !== null
      && current.goodsId !== undefined
  }

  const getCurrentCopyIdentity = () => {
    const latest = getAffiliateCapabilitySnapshot()
    return {
      identity: {
        requestRevision: requestRevision.current,
        capabilityRevision: latest.revision,
        goodsId: currentGoodsIdRef.current,
        resolutionToken: currentResolutionTokenRef.current,
        requiresResolutionToken: requiresResolutionTokenRef.current,
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

  const convert = useCallback(async (purchaseProduct: AffiliatePurchaseProduct): Promise<AffiliateConvertResult | null> => {
    const goodsId = purchaseProduct.goods_id
    const resolutionToken = purchaseProduct.resolution_token
    const needsResolutionToken = purchaseProduct.requires_resolution_token === true
    if (needsResolutionToken && (typeof resolutionToken !== 'string' || !resolutionToken.trim())) {
      requestRevision.current += 1
      setLoading(false)
      setResult(null)
      setCopyFallback(null)
      setResolutionTicketFailure('missing')
      setError(getAffiliateResolutionTicketMessage('missing'))
      onResolutionTokenInvalidRef.current?.()
      return null
    }
    const revision = requestRevision.current + 1
    const capabilityRevision = getAffiliateCapabilitySnapshot().revision
    requestRevision.current = revision
    const capturedIdentity = {
      requestRevision: revision,
      capabilityRevision,
      goodsId,
      resolutionToken,
      requiresResolutionToken: needsResolutionToken,
    }
    const isCurrentConversion = () => {
      const latest = getAffiliateCapabilitySnapshot()
      return requestRevision.current === capturedIdentity.requestRevision
        && latest.revision === capturedIdentity.capabilityRevision
        && currentGoodsIdRef.current === capturedIdentity.goodsId
        && currentResolutionTokenRef.current === capturedIdentity.resolutionToken
        && requiresResolutionTokenRef.current === capturedIdentity.requiresResolutionToken
    }
    setLoading(true)
    setError('')
    setResolutionTicketFailure(null)
    setResult(null)
    setCopyFallback(null)
    setRefreshConfirmationRequired(false)
    try {
      const conversion = await runAffiliateConversionAfterRefresh({
        captured: capturedIdentity,
        getCurrent: () => ({
          requestRevision: requestRevision.current,
          capabilityRevision: getAffiliateCapabilitySnapshot().revision,
          goodsId: currentGoodsIdRef.current,
          resolutionToken: currentResolutionTokenRef.current,
          requiresResolutionToken: requiresResolutionTokenRef.current,
        }),
        refreshCapabilities: refreshAffiliateCapabilities,
        canConvert: (latest) => canUseAffiliateCapability(latest.capabilities, 'convert'),
        convert: () => needsResolutionToken && resolutionToken
          ? convertAffiliateResolution(resolutionToken)
          : convertAffiliateGoods(goodsId),
      })
      if (conversion.kind === 'stale') return null
      if (conversion.kind === 'unavailable') {
        if (isCurrentConversion()) {
          setError('推广购买功能暂不可用，请稍后再试。')
        }
        return null
      }
      const response = conversion.value
      if (isCurrentConversion()
        && getAffiliateCapabilitySnapshot().capabilities.convert_enabled) setResult(response)
      return response
    } catch (convertError) {
      if (isCurrentConversion()) {
        const ticketFailure = needsResolutionToken
          ? getAffiliateResolutionTicketFailure(convertError)
          : null
        if (ticketFailure && resolutionToken) {
          clearAffiliateGoodsResolutionToken(goodsId, resolutionToken)
          setResolutionTicketFailure(ticketFailure)
          setError(getAffiliateResolutionTicketMessage(ticketFailure))
          onResolutionTokenInvalidRef.current?.()
        } else {
          setResolutionTicketFailure(null)
          setError(convertError instanceof Error ? convertError.message : '生成推广链接失败，请稍后重试')
        }
      }
      return null
    } finally {
      if (requestRevision.current === revision) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!product || !currentGoodsId || !capabilitySnapshot.loaded) return undefined
    if (!convertEnabled) {
      requestRevision.current += 1
      setLoading(false)
      setResult(null)
      setCopyFallback(null)
      setResolutionTicketFailure(null)
      setError('推广购买功能暂不可用，请稍后再试。')
      setRefreshConfirmationRequired(false)
      return undefined
    }
    void convert(product)
    return () => { requestRevision.current += 1 }
  }, [capabilitySnapshot.loaded, capabilitySnapshot.revision, convertEnabled, convert, product, currentGoodsId, currentResolutionToken, requiresResolutionToken])

  useEffect(() => {
    if (!copyFallback?.expiresAt) return undefined
    const expiresAt = Date.parse(copyFallback.expiresAt)
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      setCopyFallback(null)
      return undefined
    }
    const timeout = setTimeout(() => setCopyFallback(null), expiresAt - Date.now())
    return () => clearTimeout(timeout)
  }, [copyFallback])

  const latestCopyIdentity = getCurrentCopyIdentity()
  const copySession = getCurrentCopySession()
  const copyInFlight = Boolean(
    copyInFlightSession
    && copyInFlightSession.generation === copySession.generation
    && copyInFlightSession.goodsId === copySession.goodsId
    && copyInFlightSession.capabilityRevision === copySession.capabilityRevision,
  )
  const visibleCopyFallback = isAffiliateCopyFallbackUsable(
    copyFallback,
    latestCopyIdentity.identity,
    latestCopyIdentity.capabilities,
  ) ? copyFallback : null

  const copyConvertedLink = async () => {
    if (!result || loading || !product) return
    const capturedResult = result
    const capturedProduct = product
    const capturedGoodsId = product.goods_id
    const capturedCapabilityRevision = getAffiliateCapabilitySnapshot().revision
    let capturedRequestRevision = requestRevision.current
    const capturedSession = getCurrentCopySession()
    const capturedIdentity = (): AffiliateCopyOperationIdentity => ({
      requestRevision: capturedRequestRevision,
      capabilityRevision: capturedCapabilityRevision,
      goodsId: capturedGoodsId,
      resolutionToken: capturedProduct.resolution_token,
      requiresResolutionToken: capturedProduct.requires_resolution_token === true,
    })

    await runAffiliateCopyOperationExclusive(
      copyOperationLockRef.current,
      capturedSession,
      isCurrentCopySession,
      setCopyInFlightSession,
      async () => {
        try {
          await refreshAffiliateCapabilities()
          if (!isCurrentCopyOperation(capturedIdentity())) return

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
              const refreshedRequest = convert(capturedProduct)
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
              try {
                const clipboardOperation = runAffiliateCopyIfCurrent(
                  latest.identity,
                  capturedIdentity(),
                  latest.capabilities,
                  () => Taro.setClipboardData({ data: clipboardText }),
                )
                if (!clipboardOperation) return false
                await clipboardOperation
              } catch {
                if (!isCurrentCopyOperation(capturedIdentity())) return false
                if (isAffiliateLinkExpired(copyResult.expires_at)) {
                  const refreshedRequest = convert(capturedProduct)
                  capturedRequestRevision = requestRevision.current
                  const refreshed = await refreshedRequest
                  if (refreshed && isCurrentCopyOperation(capturedIdentity())) {
                    if (isAffiliateLinkExpired(refreshed.expires_at)) {
                      showToast({ title: '新推广链接已过期，请稍后重试', icon: 'none' })
                    } else {
                      setRefreshConfirmationRequired(true)
                      showToast({ title: '优惠已刷新，请确认后复制', icon: 'none' })
                    }
                  }
                  return false
                }
                const fallback: AffiliateCopyFallback = {
                  text: clipboardText,
                  expiresAt: copyResult.expires_at,
                  identity: capturedIdentity(),
                }
                const current = getCurrentCopyIdentity()
                if (!isAffiliateCopyFallbackUsable(
                  fallback,
                  current.identity,
                  current.capabilities,
                )) return false
                setCopyFallback(fallback)
                showToast({ title: '复制失败，可长按选择文本手动复制', icon: 'none' })
                return false
              }
              setCopyFallback(null)
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
      },
    )
  }

  if (!product) return null

  return (
    <BottomSheet
      visible
      title='优惠与购买'
      onClose={onClose}
      footer={(
        <View
          className={`coupon-purchase-sheet__primary ${!result || loading || copyInFlight || !convertEnabled ? 'coupon-purchase-sheet__primary--disabled' : ''}`}
          ariaRole='button'
          ariaLabel={copyInFlight
            ? '正在处理推广购买流程'
            : result
            ? !convertEnabled
              ? '推广购买暂不可用'
              : hasAffiliateOfferChanged(product, result) || refreshConfirmationRequired
              ? '确认优惠信息后复制推广口令或链接'
              : '复制推广口令或链接'
            : '推广链接暂不可用'}
          onClick={() => void copyConvertedLink()}
        >
          {copyInFlight ? '正在处理…' : result?.taobao_password ? '复制淘口令' : '复制购买链接'}
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
              ariaLabel={resolutionTicketFailure ? '重新粘贴商品链接' : '重试生成推广链接'}
              onClick={() => {
                if (resolutionTicketFailure) onRepaste?.()
                else void convert(product)
              }}
            >
              {resolutionTicketFailure ? '重新粘贴链接查券' : '重试'}
            </View>
          </View>
        )}
        {result && convertEnabled && (
          <View className='coupon-purchase-sheet__result'>
            {(refreshConfirmationRequired || hasAffiliateOfferChanged(product, result)) && (
              <View className='coupon-purchase-sheet__updated' ariaRole='status'>优惠信息已更新，请确认后复制。</View>
            )}
            <View className='coupon-purchase-sheet__coupon'>
              <Text className='coupon-purchase-sheet__coupon-label'>
                {convertStatusLabels[convertedDisplay?.couponStatus || result.coupon_status]}
              </Text>
              {convertedDisplay?.couponActive && result.coupon_amount && (
                <Text className='coupon-purchase-sheet__coupon-amount'>¥{result.coupon_amount}</Text>
              )}
              {convertedDisplay?.couponActive && result.coupon_condition && (
                <Text className='coupon-purchase-sheet__condition'>{result.coupon_condition}</Text>
              )}
            </View>
            {promotion && (
              <View className='coupon-purchase-sheet__promotion' ariaRole='status'>
                <View className='coupon-purchase-sheet__promotion-heading'>
                  <Text className='coupon-purchase-sheet__promotion-kind'>{promotion.typeLabel}</Text>
                  {promotion.title !== promotion.typeLabel && (
                    <Text className='coupon-purchase-sheet__promotion-title'>{promotion.title}</Text>
                  )}
                </View>
                {promotion.discountLabel && (
                  <Text className='coupon-purchase-sheet__promotion-discount'>{promotion.discountLabel}</Text>
                )}
                <Text className='coupon-purchase-sheet__promotion-time'>活动时间 {promotion.timeRange}</Text>
              </View>
            )}
            <View className='coupon-purchase-sheet__price-row'>
              <Text>{convertedDisplay?.priceLabel || '商品参考价'}</Text>
              <Text className='coupon-purchase-sheet__price'>
                {convertedDisplay?.price.value ? `¥${convertedDisplay.price.value}` : '以淘宝商品页为准'}
              </Text>
            </View>
            {formatExpireTime(result.expires_at) && (
              <Text className='coupon-purchase-sheet__expires'>{formatExpireTime(result.expires_at)}</Text>
            )}
            <Text className='coupon-purchase-sheet__hint'>{convertedDisplay?.hint || '打开淘宝后核对商品价格和购买规则，再下单'}</Text>
            {visibleCopyFallback && (
              <View className='coupon-purchase-sheet__copy-fallback' ariaRole='status'>
                <Text className='coupon-purchase-sheet__copy-fallback-label'>复制失败，可长按选择下方文本手动复制</Text>
                <Text className='coupon-purchase-sheet__copy-fallback-text' selectable>
                  {visibleCopyFallback.text}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </BottomSheet>
  )
}
