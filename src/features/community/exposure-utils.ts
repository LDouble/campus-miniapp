export const POST_EXPOSURE_DURATION_MS = 1_000

export type ExposureClock = {
  now: () => number
  setTimeout: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>
  clearTimeout: (timer: ReturnType<typeof setTimeout>) => void
}

export type PostExposureControllerOptions = {
  onExposure: () => void | Promise<void>
  /** 到期时重新测量，防止滚动或布局变化后的旧定时器误报。 */
  recheck: () => boolean | Promise<boolean>
  clock?: ExposureClock
}

export type PostExposureController = {
  updateVisible: (visible: boolean) => void
  hide: () => void
  show: () => void
  dispose: () => void
}

const browserClock: ExposureClock = {
  now: () => Date.now(),
  setTimeout: (callback, delay) => setTimeout(callback, delay),
  clearTimeout: (timer) => clearTimeout(timer),
}

/**
 * 管理单个卡片的一段连续曝光。离开可见区后会重置，重新进入可再次上报；
 * 跨请求的 30 分钟去重由调用方的后端调度器负责。
 */
export const createPostExposureController = (
  options: PostExposureControllerOptions,
): PostExposureController => {
  const clock = options.clock ?? browserClock
  let timer: ReturnType<typeof setTimeout> | undefined
  let visible = false
  let hidden = false
  let disposed = false
  let reportedForCurrentExposure = false
  let exposureId = 0

  const clearTimer = () => {
    if (timer === undefined) return
    clock.clearTimeout(timer)
    timer = undefined
  }

  const report = () => {
    try {
      void Promise.resolve(options.onExposure()).catch(() => undefined)
    } catch {
      // 阅读量是弱一致数据，回调错误不应影响页面。
    }
  }

  const schedule = () => {
    if (disposed || hidden || !visible || reportedForCurrentExposure || timer !== undefined) return
    const scheduledAt = clock.now()
    const scheduledExposureId = exposureId
    timer = clock.setTimeout(() => {
      timer = undefined
      if (disposed || hidden || !visible || reportedForCurrentExposure || scheduledExposureId !== exposureId) return
      const elapsed = clock.now() - scheduledAt
      if (elapsed < POST_EXPOSURE_DURATION_MS) {
        schedule()
        return
      }
      try {
        void Promise.resolve(options.recheck()).then((stillVisible) => {
          if (disposed || hidden || !visible || reportedForCurrentExposure || scheduledExposureId !== exposureId || !stillVisible) {
            if (!stillVisible && scheduledExposureId === exposureId) visible = false
            return
          }
          reportedForCurrentExposure = true
          report()
        }).catch(() => {
          // 无法重新测量时宁可不计数，避免失焦页的误报。
        })
      } catch {
        // 同上。
      }
    }, POST_EXPOSURE_DURATION_MS)
  }

  return {
    updateVisible(nextVisible) {
      if (disposed || hidden) return
      if (!nextVisible) {
        visible = false
        reportedForCurrentExposure = false
        exposureId += 1
        clearTimer()
        return
      }
      if (visible) return
      visible = true
      exposureId += 1
      schedule()
    },
    hide() {
      hidden = true
      visible = false
      reportedForCurrentExposure = false
      exposureId += 1
      clearTimer()
    },
    show() {
      if (disposed) return
      hidden = false
    },
    dispose() {
      disposed = true
      visible = false
      exposureId += 1
      clearTimer()
    },
  }
}

export type ExposureRect = {
  top: number
  bottom: number
  left: number
  right: number
  width: number
  height: number
}

export const isPostExposed = (
  card: ExposureRect | null | undefined,
  viewport: { top: number; bottom: number; left?: number; right?: number },
) => {
  if (!card || card.width <= 0 || card.height <= 0 || viewport.bottom <= viewport.top) return false
  const viewportLeft = viewport.left ?? 0
  const viewportRight = viewport.right ?? card.right
  const visibleWidth = Math.max(0, Math.min(card.right, card.left + card.width, viewportRight) - Math.max(card.left, viewportLeft))
  const visibleHeight = Math.max(0, Math.min(card.bottom, viewport.bottom) - Math.max(card.top, viewport.top))
  const requiredArea = card.width * Math.min(card.height, viewport.bottom - viewport.top) * 0.5
  return visibleWidth * visibleHeight >= requiredArea
}

export const getPostExposureThreshold = (cardHeight: number, viewportHeight: number) => {
  if (cardHeight <= 0 || viewportHeight <= 0) return 0.5
  return Math.min(0.5, (viewportHeight * 0.5) / cardHeight)
}
