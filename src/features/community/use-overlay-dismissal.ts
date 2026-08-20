import { useEffect, useRef } from 'react'
import { usePageScroll } from '@tarojs/taro'

type Options = {
  active: boolean
  onDismiss: () => void
}

/** 页面开始滚动时收起当前社区操作层，避免悬浮交互跟随内容错位。 */
export function useDismissCommunityOverlaysOnScroll({ active, onDismiss }: Options) {
  const activeRef = useRef(active)
  const dismissRef = useRef(onDismiss)

  useEffect(() => {
    activeRef.current = active
  }, [active])

  useEffect(() => {
    dismissRef.current = onDismiss
  }, [onDismiss])

  usePageScroll(() => {
    if (!activeRef.current) return
    activeRef.current = false
    dismissRef.current()
  })
}
