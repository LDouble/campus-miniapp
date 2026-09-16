export const singleContentImageLayout = (width?: number, height?: number) => {
  if (!width || !height || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: 424, height: 212, long: false }
  }
  const displayWidth = height > width ? 320 : 424
  const naturalHeight = displayWidth * height / width
  return { width: displayWidth, height: Math.min(560, naturalHeight), long: naturalHeight > 560 }
}
