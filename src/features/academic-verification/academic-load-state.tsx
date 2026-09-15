import { Text, View } from '@tarojs/components'
import './academic-load-state.scss'

interface AcademicLoadStateCardProps {
  title: string
  message: string
  actionLabel: string
  actionDisabled?: boolean
  onAction: () => void
}

export default function AcademicLoadStateCard({
  title,
  message,
  actionLabel,
  actionDisabled = false,
  onAction,
}: AcademicLoadStateCardProps) {
  return (
    <View className='academic-load-state'>
      <View className='academic-load-state__heading'>
        <View className='academic-load-state__mark'>!</View>
        <View className='academic-load-state__heading-copy'>
          <Text className='academic-load-state__title'>{title}</Text>
          <Text className='academic-load-state__copy'>{message}</Text>
        </View>
      </View>
      <View
        className={`academic-load-state__action ${actionDisabled ? 'academic-load-state__action--disabled' : ''}`}
        ariaRole='button'
        ariaLabel={actionLabel}
        onClick={() => {
          if (!actionDisabled) onAction()
        }}
      >
        {actionLabel}
      </View>
    </View>
  )
}
