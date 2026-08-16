import type { ReactNode } from 'react'
import { Text, View } from '@tarojs/components'
import StickerContent from '../../../components/sticker-content'

type DetailBusinessIntroProps = {
  badges?: string[]
  title?: string | null
  description?: string | null
  action?: ReactNode
  children: ReactNode
}

export default function DetailBusinessIntro({
  badges = [],
  title,
  description,
  action,
  children,
}: DetailBusinessIntroProps) {
  const visibleBadges = badges.map((badge) => badge.trim()).filter(Boolean)

  return (
    <View className='detail-overview detail-business-intro'>
      {(visibleBadges.length > 0 || action) && (
        <View className='detail-overview__toolbar'>
          <View className='detail-overview__badges'>
            {visibleBadges.map((badge) => <Text key={badge}>{badge}</Text>)}
          </View>
          {action}
        </View>
      )}
      {title?.trim() && (
        <StickerContent
          content={title.trim()}
          className='detail-overview__title'
          stickerClassName='detail-overview__sticker'
        />
      )}
      {description?.trim() && (
        <StickerContent
          content={description.trim()}
          className='detail-overview__description'
          stickerClassName='detail-overview__sticker'
        />
      )}
      {children}
    </View>
  )
}
