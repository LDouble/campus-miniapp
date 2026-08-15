import Taro from '@tarojs/taro'
import { getSelectedTempFiles } from '../../utils/file-selection'
import {
  createLocalMediaImageDraft,
  DEFAULT_MEDIA_IMAGE_QUALITY,
  MAX_PUBLISH_IMAGES,
  mediaImageMimeFromType,
  scaledMediaImageDimensions,
  validateMediaImage,
} from './images'
import type { MediaImageDraft } from './images'

const wasCancelled = (error: unknown) => String(
  error && typeof error === 'object' && 'errMsg' in error
    ? error.errMsg
    : error instanceof Error
      ? error.message
      : error || '',
).toLowerCase().includes('cancel')

const mediaApiErrorMessage = (error: unknown, fallback: string) => {
  const message = error && typeof error === 'object' && 'errMsg' in error
    ? String(error.errMsg || '')
    : error instanceof Error
      ? error.message
      : String(error || '')
  return message || fallback
}

const fileSize = async (filePath: string) => {
  const info = await Taro.getFileInfo({ filePath })
  return 'size' in info ? Number(info.size) : 0
}

const prepareImage = async (input: {
  filePath: string
  fallbackWidth?: number
  fallbackHeight?: number
  cropSquare?: boolean
  maxDimension?: number
  quality?: number
}): Promise<MediaImageDraft> => {
  let localPath = input.filePath
  if (input.cropSquare) {
    try {
      const cropped = await Taro.cropImage({ src: localPath, cropScale: '1:1' })
      localPath = cropped.tempFilePath
    } catch (error) {
      if (wasCancelled(error)) throw error
      console.warn('[图片处理] 裁剪不可用，使用已选择的图片', {
        message: mediaApiErrorMessage(error, '未知错误'),
      })
    }
  }
  try {
    const maxDimension = input.maxDimension
    const dimensions = maxDimension
      ? await Taro.getImageInfo({ src: localPath }).then((info) => scaledMediaImageDimensions({
        width: Number(info.width),
        height: Number(info.height),
        maxDimension,
      }))
      : null
    const compressed = await Taro.compressImage({
      src: localPath,
      quality: input.quality ?? DEFAULT_MEDIA_IMAGE_QUALITY,
      ...(dimensions ? {
        compressedWidth: dimensions.width,
        compressedHeight: dimensions.height,
      } : {}),
    })
    localPath = compressed.tempFilePath
  } catch (error) {
    console.warn('[图片处理] 二次压缩不可用，使用当前图片', {
      message: mediaApiErrorMessage(error, '未知错误'),
    })
  }
  const [info, sizeBytes] = await Promise.all([
    Taro.getImageInfo({ src: localPath }),
    fileSize(localPath),
  ])
  const mimeType = mediaImageMimeFromType(info.type)
  const error = validateMediaImage({ mimeType, sizeBytes })
  if (error || !mimeType) throw new Error(error || '图片格式无法识别')
  return createLocalMediaImageDraft({
    localPath,
    mimeType,
    sizeBytes,
    width: Number(info.width) || Number(input.fallbackWidth) || 0,
    height: Number(info.height) || Number(input.fallbackHeight) || 0,
  })
}

export const chooseMediaImages = async (input: {
  count: number
  cropSquare?: boolean
  maxDimension?: number
  quality?: number
}): Promise<MediaImageDraft[]> => {
  try {
    const result = await Taro.chooseMedia({
      count: Math.max(1, Math.min(MAX_PUBLISH_IMAGES, input.count)),
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
    })
    return Promise.all(getSelectedTempFiles(result).map((file) => prepareImage({
      filePath: file.tempFilePath,
      fallbackWidth: file.width,
      fallbackHeight: file.height,
      cropSquare: input.cropSquare,
      maxDimension: input.maxDimension,
      quality: input.quality,
    })))
  } catch (error) {
    if (wasCancelled(error)) return []
    throw new Error(mediaApiErrorMessage(error, '图片选择失败，请重试'))
  }
}
