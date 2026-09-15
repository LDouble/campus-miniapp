import { useEffect, useRef } from 'react'
import { usePageScroll } from '@tarojs/taro'

type Options = {
  active: boolean
  onDismiss: () => void
}

let dismissSuppressedUntil = 0

export const suppressCommunityOverlayDismiss = (duration = 400) => {
  dismissSuppressedUntil = Math.max(dismissSuppressedUntil, Date.now() + duration)
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
    if (!activeRef.current || Date.now() < dismissSuppressedUntil) return
    activeRef.current = false
    dismissRef.current()
  })
}
