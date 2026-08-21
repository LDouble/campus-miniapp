import type { ReactNode } from 'react'
import { Text, View } from '@tarojs/components'
import UserAvatar from '../../../components/user-avatar'
import { openPublicProfile } from '../../profile/public-profile'
import './detail-author-header.scss'

type DetailAuthorHeaderProps = {
  action?: ReactNode
  avatarUrl?: string | null
  badge?: ReactNode
  fallback?: string
  meta?: ReactNode
  nickname?: string | null
  profileEnabled?: boolean
  userId: number
}

export default function DetailAuthorHeader({
  action,
  avatarUrl,
  badge,
  fallback,
  meta,
  nickname,
  profileEnabled = true,
  userId,
}: DetailAuthorHeaderProps) {
  const name = nickname?.trim() || `用户 #${userId}`
  const [initial = '同'] = Array.from(fallback?.trim() || name)
  const canOpenProfile = profileEnabled && userId > 0

  return (
    <View className='detail-author-header'>
      <View
        className={canOpenProfile
          ? 'detail-author-header__identity'
          : 'detail-author-header__identity detail-author-header__identity--disabled'}
        ariaRole={canOpenProfile ? 'button' : undefined}
        ariaLabel={canOpenProfile ? `查看${name}的个人主页` : undefined}
        onClick={() => {
          if (canOpenProfile) void openPublicProfile(userId)
        }}
      >
        <UserAvatar
          src={avatarUrl?.trim() || ''}
          className='detail-author-header__avatar'
          imageClassName='detail-author-header__avatar-image'
          fallback={initial}
          userId={canOpenProfile ? userId : 0}
          lazyLoad
          shape='rounded'
        />
        <View className='detail-author-header__copy'>
          <View className='detail-author-header__name-row'>
            <Text className='detail-author-header__name'>{name}</Text>
            {badge}
          </View>
          {meta && <View className='detail-author-header__meta'>{meta}</View>}
        </View>
      </View>
      {action && <View className='detail-author-header__action'>{action}</View>}
    </View>
  )
}
