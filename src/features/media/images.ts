export const MAX_PUBLISH_IMAGES = 9
export const MAX_MEDIA_IMAGE_BYTES = 5 * 1024 * 1024
export const DEFAULT_MEDIA_IMAGE_QUALITY = 82
export const AVATAR_IMAGE_MAX_DIMENSION = 512
export const AVATAR_IMAGE_QUALITY = 80
export const MEDIA_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
] as const

export type MediaImageMimeType = typeof MEDIA_IMAGE_MIME_TYPES[number]
export type MediaImageStatus = 'ready' | 'uploading' | 'uploaded' | 'failed'

export type MediaImageDraft = {
  key: string
  localPath: string
  previewUrl: string
  mediaId?: number
  legacyUrl: string
  mimeType: MediaImageMimeType
  sizeBytes: number
  width: number
  height: number
  status: MediaImageStatus
  progress: number
  error: string
}

let mediaImageSequence = 0

const nextMediaImageKey = () => {
  mediaImageSequence += 1
  return `media-image-${Date.now().toString(36)}-${mediaImageSequence}`
}

export const mediaImageMimeFromType = (type?: string): MediaImageMimeType | null => {
  const normalized = String(type || '').toLowerCase()
  if (normalized === 'jpg' || normalized === 'jpeg') return 'image/jpeg'
  if (normalized === 'png') return 'image/png'
  return null
}

export const validateMediaImage = (input: {
  mimeType: string | null
  sizeBytes: number
}) => {
  if (!input.mimeType || !MEDIA_IMAGE_MIME_TYPES.includes(input.mimeType as MediaImageMimeType)) {
    return '仅支持 JPEG 或 PNG 图片'
  }
  if (input.sizeBytes <= 0) return '图片文件无效，请重新选择'
  if (input.sizeBytes > MAX_MEDIA_IMAGE_BYTES) return '单张图片不能超过 5 MiB'
  return ''
}

export const scaledMediaImageDimensions = (input: {
  width: number
  height: number
  maxDimension: number
}) => {
  const width = Math.floor(input.width)
  const height = Math.floor(input.height)
  const maxDimension = Math.floor(input.maxDimension)
  const longestDimension = Math.max(width, height)
  if (width <= 0 || height <= 0 || maxDimension <= 0 || longestDimension <= maxDimension) {
    return null
  }
  const scale = maxDimension / longestDimension
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

export const moveMediaImage = (
  images: MediaImageDraft[],
  index: number,
  direction: -1 | 1,
) => {
  const target = index + direction
  if (index < 0 || target < 0 || index >= images.length || target >= images.length) {
    return images
  }
  const next = [...images]
  const current = next[index]
  next[index] = next[target]
  next[target] = current
  return next
}

export const serverMediaImageDraft = (input: {
  url: string
  mediaId?: number
}): MediaImageDraft => ({
  key: nextMediaImageKey(),
  localPath: '',
  previewUrl: input.url,
  mediaId: input.mediaId,
  legacyUrl: input.mediaId ? '' : input.url,
  mimeType: 'image/jpeg',
  sizeBytes: 1,
  width: 0,
  height: 0,
  status: 'uploaded',
  progress: 100,
  error: '',
})

export const mediaImageValidationError = (
  images: MediaImageDraft[],
  maxCount = MAX_PUBLISH_IMAGES,
) => {
  if (images.length > maxCount) return `图片最多上传 ${maxCount} 张`
  if (
    images.some((image) => Boolean(image.mediaId))
    && images.some((image) => Boolean(image.legacyUrl))
  ) return '历史图片与新图片不能混用，请重新选择'
  if (images.some((image) => image.status === 'uploading')) return '图片仍在上传，请稍候'
  if (images.some((image) => image.status === 'failed')) return '有图片上传失败，请重试或删除'
  if (images.some((image) => (
    image.status !== 'uploaded' || (!image.mediaId && !image.legacyUrl)
  ))) {
    return '请等待所有图片上传完成'
  }
  return ''
}

export const createLocalMediaImageDraft = (input: {
  localPath: string
  mimeType: MediaImageMimeType
  sizeBytes: number
  width: number
  height: number
}): MediaImageDraft => ({
  key: nextMediaImageKey(),
  localPath: input.localPath,
  previewUrl: input.localPath,
  legacyUrl: '',
  mimeType: input.mimeType,
  sizeBytes: input.sizeBytes,
  width: input.width,
  height: input.height,
  status: 'ready',
  progress: 0,
  error: '',
})
