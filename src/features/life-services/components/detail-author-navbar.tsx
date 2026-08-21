import { Text, View } from '@tarojs/components'
import UserAvatar from '../../../components/user-avatar'
import { openPublicProfile } from '../../profile/public-profile'

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
    <View
      className='business-detail-author'
      ariaRole='button'
      ariaLabel={`查看${name}的个人主页`}
      onClick={() => void openPublicProfile(userId)}
    >
      <UserAvatar
        src={avatarUrl?.trim() || ''}
        className='business-detail-author__avatar'
        imageClassName='business-detail-author__avatar-image'
        fallback={fallback}
        userId={userId}
        lazyLoad
      />
      <Text>{name}</Text>
    </View>
  )
}
