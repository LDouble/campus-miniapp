import { useEffect, useState } from 'react'
import { Image, Text, View } from '@tarojs/components'
import type { CommentImageView, PublicCommentImagePreview } from '../../../api/types'
import { previewContentImages } from '../content-image-preview'
import './comment-image.scss'

export type CommentImageData = CommentImageView | PublicCommentImagePreview

type CommentImageProps = {
  image?: CommentImageData | null
  compact?: boolean
  label?: string
}

export default function CommentImage({
  image,
  compact = false,
  label = '评论图片',
}: CommentImageProps) {
  const url = image?.url?.trim() || ''
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [url])

  if (!url) return null

  return (
    <View
      className={compact
        ? 'community-comment-image community-comment-image--compact'
        : 'community-comment-image'}
      hoverClass='none'
      ariaRole='button'
      ariaLabel={`预览${label}`}
      onClick={(event) => {
        event.stopPropagation()
        if (!failed) previewContentImages(url, [url])
      }}
    >
      {failed ? (
        <Text>图片暂不可用</Text>
      ) : (
        <Image
          src={url}
          mode='aspectFill'
          lazyLoad
          ariaLabel={label}
          onError={() => setFailed(true)}
        />
      )}
    </View>
  )
}
