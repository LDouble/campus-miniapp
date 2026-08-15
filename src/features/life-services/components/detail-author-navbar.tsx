import { Text, View } from '@tarojs/components'
import UserAvatarImage from '../../../components/user-avatar-image'

type DetailAuthorNavbarProps = {
  avatarUrl?: string | null
  nickname?: string | null
  userId: number
}

export default function DetailAuthorNavbar({
  avatarUrl,
  nickname,
  userId,
}: DetailAuthorNavbarProps) {
  const name = nickname?.trim() || `用户 #${userId}`
  const [fallback = '同'] = Array.from(name)

  return (
    <View className='business-detail-author'>
      <View className='business-detail-author__avatar'>
        <UserAvatarImage
          src={avatarUrl?.trim() || ''}
          className='business-detail-author__avatar-image'
          fallback={fallback}
          lazyLoad
        />
      </View>
      <Text>{name}</Text>
    </View>
  )
}
