import { useCallback, useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { AdCustom, Image, Text, View } from '@tarojs/components'
import type { ITouchEvent } from '@tarojs/components'
import mascot from './mascot-v2.png'
import guideArrow from './guide-arrow.svg'
import accentMark from './accent.svg'
import dashMark from './dash.svg'
import { MEMBER_AD_UNIT_ID } from './preload'
import { getMemberAdPoint, isMemberAdHotspotTap, isMemberAdTapGestureValid } from './hotspot'
import type { MemberAdTap } from './hotspot'
import './popup.scss'

type Props = {
  visible: boolean
  onReady: () => void
  onPresented: () => void
  onClose: () => void
  onAdTap?: () => void | Promise<void>
  rewardCount?: number
  claiming?: boolean
  onError?: (message: string) => void
}

let memberAdPopupSequence = 0

const MemberAdPopup = ({
  visible,
  onReady,
  onPresented,
  onClose,
  onAdTap,
  rewardCount,
  claiming = false,
  onError,
}: Props) => {
  const [nativeClosed, setNativeClosed] = useState(false)
  const nativeClosedRef = useRef(false)
  const loaded = useRef(false)
  const active = useRef(true)
  const presented = useRef(false)
  const visibleRef = useRef(visible)
  visibleRef.current = visible
  const claimingRef = useRef(claiming)
  claimingRef.current = claiming
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady
  const onPresentedRef = useRef(onPresented)
  onPresentedRef.current = onPresented
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const onAdTapRef = useRef(onAdTap)
  onAdTapRef.current = onAdTap
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const measureVersion = useRef(0)
  const gestureVersion = useRef(0)
  const gesture = useRef<MemberAdTap | null>(null)
  const adContainerId = useRef('')
  if (!adContainerId.current) {
    memberAdPopupSequence += 1
    adContainerId.current = `member-ad-popup-ad-${memberAdPopupSequence}`
  }

  const close = useCallback(() => {
    if (!active.current) return
    active.current = false
    gesture.current = null
    measureVersion.current += 1
    gestureVersion.current += 1
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    onCloseRef.current()
  }, [])

  useEffect(() => {
    active.current = true
    // 准备阶段不阻断首页；超时或离页后不允许迟到事件重新弹出。
    timerRef.current = setTimeout(() => {
      if (!loaded.current) {
        onErrorRef.current?.('广告加载超时，请稍后重试')
        close()
      }
    }, 8000)
    return () => {
      active.current = false
      gesture.current = null
      measureVersion.current += 1
      gestureVersion.current += 1
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [close])

  useEffect(() => {
    gesture.current = null
    measureVersion.current += 1
    gestureVersion.current += 1
    if (!visible) return
    const handleWindowResize = () => { measureVersion.current += 1 }
    Taro.onWindowResize(handleWindowResize)
    return () => {
      measureVersion.current += 1
      gestureVersion.current += 1
      Taro.offWindowResize(handleWindowResize)
    }
  }, [visible])

  useEffect(() => {
    if (!visible || presented.current) return
    // 等待可见状态提交到原生视图；准备、阻挡和离页都不计入展示。
    Taro.nextTick(() => {
      if (!active.current || !visibleRef.current || !loaded.current || presented.current) return
      presented.current = true
      onPresentedRef.current()
    })
  }, [visible])

  const startHotspotTouch = (event: ITouchEvent) => {
    gesture.current = null
    if (!active.current || !visibleRef.current || !loaded.current || nativeClosedRef.current || claimingRef.current
      || event.touches.length !== 1) return
    const start = getMemberAdPoint(event.touches[0])
    if (!start) return
    gestureVersion.current += 1
    gesture.current = { start, startedAt: Date.now(), cancelled: false }
  }

  const moveHotspotTouch = (event: ITouchEvent) => {
    const current = gesture.current
    if (!current) return
    if (event.touches.length !== 1) {
      current.cancelled = true
      return
    }
    const point = getMemberAdPoint(event.touches[0])
    if (!point || Math.hypot(point.x - current.start.x, point.y - current.start.y) > 14) {
      current.cancelled = true
    }
  }

  const finishHotspotTouch = (event: ITouchEvent) => {
    const current = gesture.current
    gesture.current = null
    if (!current || !active.current || !visibleRef.current || !loaded.current || nativeClosedRef.current || claimingRef.current
      || event.changedTouches.length !== 1) return
    const end = getMemberAdPoint(event.changedTouches[0])
    const endedAt = Date.now()
    if (!end || !isMemberAdTapGestureValid(current, end, endedAt)) return
    // 热区矩形在本次手势结束后重新测量，覆盖抽屉滚动或窗口尺寸变化。
    const requestVersion = measureVersion.current
    const requestGesture = gestureVersion.current
    Taro.nextTick(() => {
      if (!active.current || !visibleRef.current || !loaded.current || nativeClosedRef.current || claimingRef.current
        || requestVersion !== measureVersion.current || requestGesture !== gestureVersion.current) return
      const query = Taro.createSelectorQuery()
      query.select(`#${adContainerId.current}`).boundingClientRect((measuredRect) => {
        if (!active.current || !visibleRef.current || !loaded.current || nativeClosedRef.current || claimingRef.current
          || requestVersion !== measureVersion.current || requestGesture !== gestureVersion.current) return
        const rect = Array.isArray(measuredRect) ? measuredRect[0] : measuredRect
        if (!rect || rect.width <= 0 || rect.height <= 0) return
        if (!isMemberAdHotspotTap(current, end, endedAt, {
          left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
        })) return

        try {
          const result = onAdTapRef.current?.()
          if (result && typeof result.then === 'function') {
            void result.catch((error: unknown) => {
              if (!active.current) return
              onErrorRef.current?.(error instanceof Error ? error.message : '领取失败，请再点一次广告')
            })
          }
        } catch (error) {
          onErrorRef.current?.(error instanceof Error ? error.message : '领取失败，请再点一次广告')
        }
      }).exec()
    })
  }

  const handleNativeClose = () => {
    if (!active.current || nativeClosedRef.current) return
    if (!loaded.current || !visibleRef.current || !presented.current
      || rewardCount === undefined || !onAdTapRef.current) {
      close()
      return
    }
    // 原生关闭是独立于热区触摸的兜底信号，不走遮罩关闭回调，以保留领取会话。
    nativeClosedRef.current = true
    gesture.current = null
    gestureVersion.current += 1
    measureVersion.current += 1
    setNativeClosed(true)
    if (!claimingRef.current) void onAdTapRef.current()
  }

  const failAd = () => {
    if (!active.current || nativeClosedRef.current) return
    onErrorRef.current?.('广告加载失败，请稍后重试')
    close()
  }

  return (
    <View
      className={`member-ad-popup${visible ? '' : ' member-ad-popup--preparing'}`}
      onClick={visible ? close : undefined}
      catchMove={visible}
    >
      <View className='member-ad-popup__body' onClick={(event) => event.stopPropagation()}>
        <View className='member-ad-popup__mascot-wrap'>
          <Image className='member-ad-popup__mascot' src={mascot} mode='widthFix' />
        </View>
        <View className='member-ad-popup__card' ariaRole='dialog' ariaLabel='广告推荐'>
          <View className='member-ad-popup__burst member-ad-popup__burst--left'><Image src={accentMark} /><Image src={accentMark} /></View>
          <View className='member-ad-popup__burst member-ad-popup__burst--right'><Image src={accentMark} /></View>
          <View className='member-ad-popup__title'>
            <View>能帮学长点一下</View>
            <View>这个<Text className='member-ad-popup__highlight'>广告</Text>吗？<Text className='member-ad-popup__smile'>😊</Text></View>
          </View>
          <View className='member-ad-popup__description'>
            {rewardCount === undefined ? (
              <>
                <View>OUSea 由虾米学长个人开发维护。</View>
                <View>无需下载、关注或购买，<Text className='member-ad-popup__emphasis'>点一下广告卡片即可。</Text></View>
                <View>广告收入能帮助学长持续提供更多优质内容～</View>
                <View className='member-ad-popup__thanks'>感谢你的支持！<Text>💛</Text></View>
                <View className='member-ad-popup__repeat'>每次出现，都可以点一次。</View>
              </>
            ) : (
              <>
                <View>点击广告卡片，领取下载额度。</View>
                <View className='member-ad-popup__reward-count'>成功后额度 +{rewardCount} 次</View>
                <View className='member-ad-popup__thanks'>感谢你的支持！<Text>💛</Text></View>
                {claiming && <View className='member-ad-popup__claiming'>正在领取，请稍候…</View>}
              </>
            )}
          </View>
          <View className='member-ad-popup__ad-wrap'>
            <View className='member-ad-popup__guide'>
              <Text className='member-ad-popup__guide-label'>这是广告哦～</Text>
              <Image className='member-ad-popup__guide-arrow' src={guideArrow} mode='aspectFit' />
            </View>
            <View
              id={adContainerId.current}
              className={`member-ad-popup__ad${claiming ? ' member-ad-popup__ad--claiming' : ''}`}
              ariaLabel={claiming ? '正在领取下载额度' : '点按广告卡片领取下载额度'}
              onTouchStart={startHotspotTouch}
              onTouchMove={moveHotspotTouch}
              onTouchEnd={finishHotspotTouch}
              onTouchCancel={() => { gesture.current = null }}
            >
              {nativeClosed ? (
                <View className='member-ad-popup__closed-status'>
                  <Text>{claiming ? '正在确认下载额度…' : '广告已关闭，未领取成功可重试'}</Text>
                  {!claiming && (
                    <View className='member-ad-popup__retry' ariaRole='button' ariaLabel='重试领取下载额度'
                      onClick={() => { if (active.current && !claimingRef.current) void onAdTapRef.current?.() }}
                    >
                      重试领取
                    </View>
                  )}
                </View>
              ) : <AdCustom
                unitId={MEMBER_AD_UNIT_ID}
                onLoad={() => {
                  if (!active.current || loaded.current) return
                  loaded.current = true
                  if (timerRef.current) clearTimeout(timerRef.current)
                  timerRef.current = null
                  onReadyRef.current()
                }}
                onError={failAd}
                {...{ onClose: handleNativeClose }}
              />}
            </View>
          </View>
          <View className='member-ad-popup__bottom-decor member-ad-popup__bottom-decor--left'><Image src={dashMark} /><Image src={dashMark} /></View>
          <View className='member-ad-popup__bottom-decor member-ad-popup__bottom-decor--right'><Image src={dashMark} /><Image src={dashMark} /></View>
        </View>
      </View>
    </View>
  )
}

export default MemberAdPopup
