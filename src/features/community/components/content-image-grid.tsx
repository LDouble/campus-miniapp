import { useState } from 'react'
import { Image, Text, View } from '@tarojs/components'
import { previewContentImages, warmContentImagePreview } from '../content-image-preview'
import './content-image-grid.scss'

export type ContentImageGridItem = {
  id: number | string
  url?: string | null
}

type ContentImageGridProps = {
  images: ContentImageGridItem[]
  maxImages?: number
  pendingReview?: boolean
  preview?: boolean
  reviewLabel?: string
}

export default function ContentImageGrid({
  images,
  maxImages = 9,
  pendingReview = false,
  preview = false,
  reviewLabel = '图片审核中',
}: ContentImageGridProps) {
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({})
  const visibleImages = images.slice(0, maxImages)
  const previewUrls = visibleImages.map((image) => image.url?.trim() || '').filter(Boolean)
  if (visibleImages.length === 0) return null

  const layoutCount = Math.min(visibleImages.length, 9)

  return (
    <View className={`content-image-grid content-image-grid--${layoutCount}`}>
      {visibleImages.map((image, index) => {
        const url = image.url?.trim() || ''
        const failureKey = `${image.id}:${url}`
        const imageAvailable = Boolean(url && !failedImages[failureKey])
        const canPreview = Boolean(imageAvailable && preview)

        return (
          <View
            key={image.id}
            className='content-image-grid__frame'
            ariaRole={canPreview ? 'button' : undefined}
            ariaLabel={canPreview ? `预览第 ${index + 1} 张图片，共 ${visibleImages.length} 张` : undefined}
            onClick={canPreview ? () => previewContentImages(url, previewUrls) : undefined}
          >
            {imageAvailable && (
              <Image
                className='content-image-grid__image'
                src={url}
                mode='aspectFill'
                lazyLoad
                ariaLabel={`内容图片 ${index + 1}/${visibleImages.length}`}
                onLoad={() => {
                  if (preview) warmContentImagePreview([url])
                }}
                onError={() => setFailedImages((current) => ({ ...current, [failureKey]: true }))}
              />
            )}
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
