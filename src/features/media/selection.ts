import Taro from '@tarojs/taro'
import { getSelectedTempFiles } from '../../utils/file-selection'
import {
  createLocalMediaImageDraft,
  MAX_PUBLISH_IMAGES,
  mediaImageMimeFromType,
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

const fileSize = async (filePath: string) => {
  const info = await Taro.getFileInfo({ filePath })
  return 'size' in info ? Number(info.size) : 0
}

const prepareImage = async (input: {
  filePath: string
  fallbackWidth?: number
  fallbackHeight?: number
  cropSquare?: boolean
}): Promise<MediaImageDraft> => {
  let localPath = input.filePath
  if (input.cropSquare) {
    const cropped = await Taro.cropImage({ src: localPath, cropScale: '1:1' })
    localPath = cropped.tempFilePath
  }
  const compressed = await Taro.compressImage({ src: localPath, quality: 82 })
  localPath = compressed.tempFilePath
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
    })))
  } catch (error) {
    if (wasCancelled(error)) return []
    throw error
  }
}
