import { useEffect, useMemo, useState } from 'react'
import { Image } from '@tarojs/components'

type VariantImageProps = {
  originalUrl?: string | null
  thumbnailUrl?: string | null
  className?: string
  mode?: 'scaleToFill' | 'aspectFit' | 'aspectFill' | 'widthFix' | 'heightFix' | 'top' | 'bottom' | 'center' | 'left' | 'right' | 'top left' | 'top right' | 'bottom left' | 'bottom right'
  lazyLoad?: boolean
  ariaLabel?: string
  onLoad?: (event: any) => void
  onError?: () => void
  onClick?: (event: any) => void
}

const normalizedUrl = (value?: string | null) => value?.trim() || ''

/** VariantImage 优先加载缩略图，失败时自动回退同一资源的原图。 */
export default function VariantImage({
  originalUrl,
  thumbnailUrl,
  className,
  mode = 'aspectFill',
  lazyLoad = false,
  ariaLabel,
  onLoad,
  onError,
  onClick,
}: VariantImageProps) {
  const original = normalizedUrl(originalUrl)
  const thumbnail = normalizedUrl(thumbnailUrl)
  const hasDistinctThumbnail = Boolean(thumbnail && thumbnail !== original)
  const [thumbnailFailed, setThumbnailFailed] = useState(false)
  const source = useMemo(() => hasDistinctThumbnail && !thumbnailFailed ? thumbnail : original, [hasDistinctThumbnail, original, thumbnail, thumbnailFailed])

  useEffect(() => setThumbnailFailed(false), [original, thumbnail])

  if (!source) return null

  return (
    <Image
      className={className}
      src={source}
      mode={mode}
      lazyLoad={lazyLoad}
      ariaLabel={ariaLabel}
      onLoad={onLoad}
      onClick={onClick}
      onError={() => {
        if (hasDistinctThumbnail && !thumbnailFailed) {
          setThumbnailFailed(true)
          return
        }
        onError?.()
      }}
    />
  )
}
