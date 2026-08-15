import type { ReactNode } from 'react'
import { Text, View } from '@tarojs/components'

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
      {title?.trim() && <Text className='detail-overview__title'>{title.trim()}</Text>}
      {description?.trim() && (
        <Text className='detail-overview__description'>{description.trim()}</Text>
      )}
      {children}
    </View>
  )
}
