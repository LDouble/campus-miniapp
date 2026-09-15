import type { ComponentProps, ReactNode } from 'react'
import { View } from '@tarojs/components'
import UserAvatarImage from '../user-avatar-image'
import { userAvatarTone } from './tone'
import './index.scss'

type UserAvatarProps = Omit<ComponentProps<typeof View>, 'children'> & {
  src?: string | null
  fallback: string
  imageClassName?: string
  fallbackClassName?: string
  lazyLoad?: boolean
  shape?: 'circle' | 'rounded'
  userId?: number | null
  children?: ReactNode
}

export default function UserAvatar({
  src,
  fallback,
  className,
  imageClassName,
  fallbackClassName,
  lazyLoad = false,
  shape = 'circle',
  userId,
  children,
  ...viewProps
}: UserAvatarProps) {
  const tone = userAvatarTone(userId)

  return (
    <View
      {...viewProps}
      className={[
        'campus-user-avatar',
        `campus-user-avatar--${shape}`,
        `campus-user-avatar--tone-${tone}`,
        className,
      ].filter(Boolean).join(' ')}
    >
      <UserAvatarImage
        src={src}
        className={['campus-user-avatar__image', imageClassName].filter(Boolean).join(' ')}
        fallback={fallback}
        fallbackClassName={[
          'campus-user-avatar__fallback',
          fallbackClassName,
        ].filter(Boolean).join(' ')}
        lazyLoad={lazyLoad}
      />
      {children}
    </View>
  )
}
