import { Text, View } from '@tarojs/components'
import type { UserLevelSummary } from '../../api/types'
import './level-badge.scss'

type Props = {
  level: UserLevelSummary
  compact?: boolean
}

export default function CommunityLevelBadge({ level, compact = false }: Props) {
  return (
    <View
      className={[
        'community-level-badge',
        `community-level-badge--${level.theme}`,
        compact ? 'community-level-badge--compact' : '',
      ].filter(Boolean).join(' ')}
      ariaLabel={`等级 ${level.level}，${level.name}`}
    >
      <Text>Lv.{level.level}</Text>
      <Text>{level.name}</Text>
    </View>
  )
}
