import Taro from '@tarojs/taro'
import {
  imageMimeFromType,
  MAX_CLUB_GALLERY_IMAGES,
  validateClubImage,
} from './model'
import type { ClubImageDraft, ClubMediaPurpose } from './types'

let localImageSequence = 0

const nextImageKey = () => {
  localImageSequence += 1
  return `club-image-${Date.now().toString(36)}-${localImageSequence}`
}

const cancelled = (error: unknown) => String(
  error && typeof error === 'object' && 'errMsg' in error
    ? error.errMsg
    : error instanceof Error
      ? error.message
      : error || '',
).toLowerCase().includes('cancel')

export const chooseClubImages = async (
  purpose: ClubMediaPurpose,
  count: number,
): Promise<ClubImageDraft[]> => {
  try {
    const result = await Taro.chooseMedia({
      count: Math.max(1, Math.min(MAX_CLUB_GALLERY_IMAGES, count)),
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
    })
    const resolved = await Promise.all(result.tempFiles.map(async (file) => {
      let localPath = file.tempFilePath
      let sizeBytes = file.size
      if (purpose === 'logo') {
        const cropped = await Taro.cropImage({
          src: file.tempFilePath,
          cropScale: '1:1',
        })
        localPath = cropped.tempFilePath
        const croppedFile = await Taro.getFileInfo({ filePath: localPath })
        if ('size' in croppedFile) sizeBytes = croppedFile.size
      }
      const info = await Taro.getImageInfo({ src: localPath })
      const mimeType = imageMimeFromType(info.type)
      const error = validateClubImage({ mimeType, sizeBytes })
      if (error || !mimeType) throw new Error(error || '图片格式无法识别')
      return {
        key: nextImageKey(),
        purpose,
        local_path: localPath,
        preview_url: localPath,
        mime_type: mimeType,
        size_bytes: sizeBytes,
        width: Number(info.width) || Number(file.width) || 0,
        height: Number(info.height) || Number(file.height) || 0,
        caption: '',
        sort_order: 0,
        status: 'ready',
        progress: 0,
        error: '',
      } satisfies ClubImageDraft
    }))
    return resolved
  } catch (error) {
    if (cancelled(error)) return []
    throw error
  }
}

export const serverImageDraft = (
  image: {
    media_id: number
    url: string
    width: number
    height: number
    caption: string | null
    sort_order: number
  },
  purpose: ClubMediaPurpose,
): ClubImageDraft => ({
  key: `club-media-${image.media_id}`,
  purpose,
  local_path: '',
  // 服务端 URL 是当前会话的短期预览地址，只保存在页面状态中。
  preview_url: image.url,
  mime_type: 'image/jpeg',
  size_bytes: 1,
  width: image.width,
  height: image.height,
  media_id: image.media_id,
  caption: image.caption || '',
  sort_order: image.sort_order,
  status: 'uploaded',
  progress: 100,
  error: '',
})
