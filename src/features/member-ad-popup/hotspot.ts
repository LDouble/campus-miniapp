/** AdRect 是页面视口坐标系中的广告区域。 */
export type AdRect = { left: number; top: number; right: number; bottom: number }

/** AdPoint 是页面视口坐标系中的触摸位置。 */
export type AdPoint = { x: number; y: number }

/** MemberAdTap 记录一次候选触摸及是否发生多指/明显移动。 */
export type MemberAdTap = {
  start: AdPoint
  startedAt: number
  cancelled: boolean
}

const MAX_TAP_DURATION_MS = 600
const MAX_TAP_MOVEMENT_PX = 14

/** isMemberAdTapGestureValid 检查短单指手势的时间、距离和取消状态。 */
export function isMemberAdTapGestureValid(tap: MemberAdTap, end: AdPoint, endedAt: number): boolean {
  return !tap.cancelled && endedAt >= tap.startedAt
    && endedAt - tap.startedAt <= MAX_TAP_DURATION_MS
    && Math.hypot(end.x - tap.start.x, end.y - tap.start.y) <= MAX_TAP_MOVEMENT_PX
}

/** isMemberAdHotspotTap 只接受在已测量广告区域内完成的短单指触摸。 */
export function isMemberAdHotspotTap(
  tap: MemberAdTap,
  end: AdPoint,
  endedAt: number,
  rect: AdRect | null,
): boolean {
  if (!isMemberAdTapGestureValid(tap, end, endedAt) || !rect) return false
  const contains = (point: AdPoint) => point.x >= rect.left && point.x <= rect.right
    && point.y >= rect.top && point.y <= rect.bottom
  return contains(tap.start) && contains(end)
}

/** getMemberAdPoint 从 Taro 触摸点提取视口坐标。 */
export function getMemberAdPoint(touch?: {
  clientX?: number
  clientY?: number
  pageX?: number
  pageY?: number
}): AdPoint | null {
  if (!touch) return null
  const x = Number.isFinite(touch.clientX) ? touch.clientX : touch.pageX
  const y = Number.isFinite(touch.clientY) ? touch.clientY : touch.pageY
  return Number.isFinite(x) && Number.isFinite(y) ? { x: Number(x), y: Number(y) } : null
}
