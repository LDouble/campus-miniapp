import { useState } from 'react'
import { Image, Text } from '@tarojs/components'

interface UserAvatarImageProps {
  src?: string | null
  className: string
  fallback: string
  fallbackClassName?: string
  lazyLoad?: boolean
}

export default function UserAvatarImage({
  src,
  className,
  fallback,
  fallbackClassName,
  lazyLoad = false,
}: UserAvatarImageProps) {
  const normalizedSrc = src?.trim() || ''
  const [failedSrc, setFailedSrc] = useState('')

  if (!normalizedSrc || failedSrc === normalizedSrc) {
    return <Text className={fallbackClassName}>{fallback}</Text>
  }

  return (
    <Image
      className={className}
      src={normalizedSrc}
      mode='aspectFill'
      lazyLoad={lazyLoad}
      onError={() => setFailedSrc(normalizedSrc)}
    />
  )
}
