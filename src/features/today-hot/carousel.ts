export const carouselIntervalMs = (seconds: number) => Math.min(10, Math.max(4, seconds || 5)) * 1000

/** 短轻扫可切换；长距离手势留给首页滚动。 */
export const carouselSwipeStep = (deltaY: number, itemCount: number) => {
  if (itemCount < 2 || Math.abs(deltaY) < 24 || Math.abs(deltaY) > 80) return 0
  return deltaY < 0 ? 1 : -1
}

export const nextCarouselIndex = (current: number, itemCount: number, step = 1) => {
  if (itemCount < 2) return 0
  return ((current + step) % itemCount + itemCount) % itemCount
}
