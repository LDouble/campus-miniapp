import { useEffect, useRef } from 'react'

type LoadMoreSignalOptions = {
  signal: number
  enabled: boolean
  onLoadMore: () => void
}

/**
 * 消费页面级触底信号。每个信号最多执行一次，避免加载状态变化后重复翻页。
 */
export const useLoadMoreSignal = ({
  signal,
  enabled,
  onLoadMore,
}: LoadMoreSignalOptions) => {
  const handledSignalRef = useRef(signal)

  useEffect(() => {
    if (signal <= handledSignalRef.current) return
    handledSignalRef.current = signal
    if (!enabled) return
    onLoadMore()
  }, [enabled, onLoadMore, signal])
}
