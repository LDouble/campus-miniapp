import { useRef, useState } from 'react'
import Taro, { usePageScroll, useReady } from '@tarojs/taro'
import { getSystemState } from '../state/system'

interface CollapsingHeaderOptions {
  threshold?: number
  triggerSelector?: string
  releaseGap?: number
}

export function useCollapsingHeader(options: number | CollapsingHeaderOptions = 96) {
  const config = typeof options === 'number'
    ? { threshold: options }
    : options
  const [collapsed, setCollapsed] = useState(false)
  const collapsedRef = useRef(false)
  const thresholdRef = useRef(config.threshold ?? 96)
  const releaseGap = config.releaseGap ?? 32

  useReady(() => {
    if (!config.triggerSelector) return

    const query = Taro.createSelectorQuery()
    query.select(config.triggerSelector).boundingClientRect()
    query.exec((results) => {
      const rect = results[0] as { top?: number } | undefined
      if (typeof rect?.top !== 'number') return

      const statusBarHeight = getSystemState().windowInfo.statusBarHeight
      thresholdRef.current = Math.max(rect.top - statusBarHeight, 0)
    })
  })

  usePageScroll(({ scrollTop }) => {
    const threshold = thresholdRef.current
    const releaseThreshold = Math.max(threshold - releaseGap, 0)
    const nextCollapsed = collapsedRef.current
      ? scrollTop > releaseThreshold
      : scrollTop >= threshold

    if (nextCollapsed === collapsedRef.current) return

    collapsedRef.current = nextCollapsed
    setCollapsed(nextCollapsed)
  })

  return collapsed
}
