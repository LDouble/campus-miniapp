import { useEffect, useRef } from 'react'
import Taro, { getCurrentInstance, useDidHide, useDidShow } from '@tarojs/taro'
import {
  createPostExposureController,
  getPostExposureThreshold,
  isPostExposed,
  type ExposureRect,
} from './exposure-utils'

export type UsePostExposureOptions = {
  selector: string
  enabled: boolean
  onExposure: () => void | Promise<void>
  topInset?: number
  bottomInset?: number
  topOccluderSelector?: string
  bottomOccluderSelector?: string
}

type Viewport = { top: number; bottom: number; left: number; right: number }
type Measurement = { card: ExposureRect | null; viewport: Viewport }

const asRect = (value: unknown): ExposureRect | null => {
  if (!value || typeof value !== 'object') return null
  const rect = value as Partial<ExposureRect>
  if (![rect.top, rect.bottom, rect.left, rect.right, rect.width, rect.height].every(
    (item) => typeof item === 'number',
  )) return null
  return rect as ExposureRect
}

/** 卡片达到有效视口面积要求并连续停留一秒后才上报。 */
export const usePostExposure = ({
  selector,
  enabled,
  onExposure,
  topInset = 0,
  bottomInset = 0,
  topOccluderSelector,
  bottomOccluderSelector,
}: UsePostExposureOptions) => {
  const onExposureRef = useRef(onExposure)
  const enabledRef = useRef(enabled)
  const hiddenRef = useRef(false)
  const observerRef = useRef<Taro.IntersectionObserver | null>(null)
  const restartRef = useRef<() => void>(() => undefined)
  const stopRef = useRef<() => void>(() => undefined)
  const initializedEnabledEffectRef = useRef(false)
  const pageRef = useRef(enabled ? getCurrentInstance().page : null)
  const controllerRef = useRef<ReturnType<typeof createPostExposureController>>()

  onExposureRef.current = onExposure
  enabledRef.current = enabled

  useEffect(() => {
    let page = pageRef.current
    let active = true
    let generation = 0
    let observerThreshold: number | null = null

    const disconnect = () => {
      observerRef.current?.disconnect()
      observerRef.current = null
      observerThreshold = null
    }

    const measure = (): Promise<Measurement> => new Promise((resolve) => {
      const windowInfo = Taro.getWindowInfo()
      const query = Taro.createSelectorQuery().in(page as unknown as Record<string, unknown>)
      query.select(selector).boundingClientRect()
      if (topOccluderSelector) query.select(topOccluderSelector).boundingClientRect()
      if (bottomOccluderSelector) query.select(bottomOccluderSelector).boundingClientRect()
      query.exec((result: unknown[]) => {
        const card = asRect(result?.[0])
        let index = 1
        const topOccluder = topOccluderSelector ? asRect(result?.[index++]) : null
        const bottomOccluder = bottomOccluderSelector ? asRect(result?.[index]) : null
        const top = Math.max(0, topInset, topOccluder?.bottom ?? 0)
        const occluderBottomInset = bottomOccluder ? windowInfo.windowHeight - bottomOccluder.top : 0
        const bottomInsetPx = Math.max(0, bottomInset, occluderBottomInset)
        resolve({
          card,
          viewport: {
            top,
            bottom: windowInfo.windowHeight - bottomInsetPx,
            left: 0,
            right: windowInfo.windowWidth,
          },
        })
      })
    })

    let start = () => undefined
    const controller = createPostExposureController({
      onExposure: () => onExposureRef.current(),
      recheck: async () => {
        const { card, viewport } = await measure()
        if (!active || hiddenRef.current || !enabledRef.current || !isPostExposed(card, viewport)) return false
        const threshold = getPostExposureThreshold(card?.height ?? 0, viewport.bottom - viewport.top)
        if (observerThreshold === null || Math.abs(threshold - observerThreshold) > 0.0001) {
          // 高卡片或有效视口改变，按新的阈值重新累积完整一秒。
          start()
          return false
        }
        return true
      },
    })
    controllerRef.current = controller

    const stop = () => {
      generation += 1
      disconnect()
      controller.updateVisible(false)
    }

    start = () => {
      stop()
      if (!active || hiddenRef.current || !enabledRef.current) return
      // 后台异步加载的卡片可能尚未拿到所属 Page，回到前台后再绑定。
      page = page || getCurrentInstance().page
      if (!page) return
      pageRef.current = page
      const run = generation
      Taro.nextTick(() => {
        if (!active || hiddenRef.current || !enabledRef.current || run !== generation) return
        void measure().then(({ card, viewport }) => {
          if (!active || hiddenRef.current || !enabledRef.current || run !== generation) return
          const threshold = getPostExposureThreshold(card?.height ?? 0, viewport.bottom - viewport.top)
          const observer = Taro.createIntersectionObserver(page as unknown as Record<string, unknown>, {
            thresholds: [0, threshold],
          })
          if (!active || hiddenRef.current || !enabledRef.current || run !== generation) {
            observer.disconnect()
            return
          }
          observerRef.current = observer
          observerThreshold = threshold
          observer.relativeToViewport({
            top: -viewport.top,
            bottom: viewport.bottom - Taro.getWindowInfo().windowHeight,
          })
          observer.observe(selector, (result) => {
            if (!active || hiddenRef.current || !enabledRef.current || run !== generation) return
            // 部分微信基础库的 boundingClientRect 是空对象，不能据此判定不可见。
            // 原生相交比例已经包含 relativeToViewport 的遮挡边界；到期仍用 selector query 复核。
            const ratio = result.intersectionRatio
            controller.updateVisible(typeof ratio === 'number' && Number.isFinite(ratio) && ratio >= threshold)
          })
          controller.updateVisible(isPostExposed(card, viewport))
        }).catch(() => {
          if (run === generation) controller.updateVisible(false)
        })
      })
    }

    restartRef.current = start
    stopRef.current = stop
    start()
    const onResize = () => start()
    Taro.onWindowResize?.(onResize)
    return () => {
      active = false
      Taro.offWindowResize?.(onResize)
      stop()
      controller.dispose()
      if (controllerRef.current === controller) controllerRef.current = undefined
    }
  }, [selector, topInset, bottomInset, topOccluderSelector, bottomOccluderSelector])

  useEffect(() => {
    if (!initializedEnabledEffectRef.current) {
      initializedEnabledEffectRef.current = true
      return
    }
    if (enabled) restartRef.current()
    else stopRef.current()
  }, [enabled])

  useDidHide(() => {
    hiddenRef.current = true
    stopRef.current()
    controllerRef.current?.hide()
  })

  useDidShow(() => {
    hiddenRef.current = false
    controllerRef.current?.show()
    restartRef.current()
  })
}
