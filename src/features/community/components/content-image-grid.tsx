import { useState } from 'react'
import { Image, Text, View } from '@tarojs/components'
import { previewContentImages, warmContentImagePreview } from '../content-image-preview'
import { singleContentImageLayout } from '../content-image-layout'
import './content-image-grid.scss'

export type ContentImageGridItem = {
  id: number | string
  url?: string | null
  thumbnail_url?: string | null
}

type ContentImageGridProps = {
  images: ContentImageGridItem[]
  maxImages?: number
  pendingReview?: boolean
  preview?: boolean
  preloadPreview?: boolean
  reviewLabel?: string
}

export default function ContentImageGrid({
  images,
  maxImages = 9,
  pendingReview = false,
  preview = false,
  preloadPreview = true,
  reviewLabel = '图片审核中',
}: ContentImageGridProps) {
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({})
  const [fallbackImages, setFallbackImages] = useState<Record<string, boolean>>({})
  const [dimensions, setDimensions] = useState<Record<string, { width: number; height: number }>>({})
  const visibleImages = images.slice(0, maxImages)
  const previewUrls = visibleImages.map((image) => image.url?.trim() || '').filter(Boolean)
  if (visibleImages.length === 0) return null

  const layoutCount = Math.min(visibleImages.length, 9)
  const singleKey = `${visibleImages[0].id}:${visibleImages[0].url?.trim() || ''}`
  const size = dimensions[singleKey]
  const singleLayout = singleContentImageLayout(size?.width, size?.height)

  return (
    <View className={`content-image-grid content-image-grid--${layoutCount}`} style={layoutCount === 1 ? { width: `${singleLayout.width}rpx`, height: `${singleLayout.height}rpx` } : undefined}>
      {visibleImages.map((image, index) => {
        const originalUrl = image.url?.trim() || ''
        const thumbnailUrl = image.thumbnail_url?.trim() || ''
        const imageKey = `${image.id}:${originalUrl}`
        const displayUrl = thumbnailUrl && !fallbackImages[imageKey] ? thumbnailUrl : originalUrl
        const failureKey = `${image.id}:${displayUrl}`
        const imageAvailable = Boolean(displayUrl && !failedImages[failureKey])
        const canPreview = Boolean(imageAvailable && preview && originalUrl)

        return (
          <View
            key={image.id}
            className='content-image-grid__frame'
            ariaRole={canPreview ? 'button' : undefined}
            ariaLabel={canPreview ? `预览第 ${index + 1} 张图片，共 ${visibleImages.length} 张` : undefined}
            onClick={canPreview ? () => previewContentImages(originalUrl, previewUrls) : undefined}
          >
            {imageAvailable && (
              <Image
                className='content-image-grid__image'
                src={displayUrl}
                mode={layoutCount === 1 ? 'widthFix' : 'aspectFill'}
                lazyLoad
                ariaLabel={`内容图片 ${index + 1}/${visibleImages.length}`}
                onLoad={(event) => {
                  if (layoutCount === 1) {
                    const width = Number(event.detail.width)
                    const height = Number(event.detail.height)
                    if (width > 0 && height > 0) setDimensions((current) => ({ ...current, [singleKey]: { width, height } }))
                  }
                  if (preview && preloadPreview && originalUrl) warmContentImagePreview([originalUrl])
                }}
                onError={() => {
                  if (thumbnailUrl && displayUrl === thumbnailUrl && originalUrl) {
                    setFallbackImages((current) => ({ ...current, [imageKey]: true }))
                    return
                  }
                  setFailedImages((current) => ({ ...current, [failureKey]: true }))
                }}
              />
            )}
            {layoutCount === 1 && singleLayout.long && imageAvailable && !pendingReview && <Text className='content-image-grid__long-label'>长图</Text>}
            {pendingReview && (
              <View className={imageAvailable
                ? 'content-image-grid__reviewing content-image-grid__reviewing--overlay'
                : 'content-image-grid__reviewing'}
              >
                <Text>{reviewLabel}</Text>
              </View>
            )}
            {!pendingReview && !imageAvailable && (
              <View className='content-image-grid__unavailable'>
                <Text>图片暂不可用</Text>
              </View>
            )}
          </View>
        )
      })}
    </View>
  )
}
