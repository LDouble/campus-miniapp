/** 占位为 4:3，加载后按原比例展示，竖图最高 4:5。 */
export function catPhotoHeightPercent(width: number, height: number): number {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 75
  return Math.min(height / width * 100, 125)
}
