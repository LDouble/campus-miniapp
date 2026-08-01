import { Text, View } from '@tarojs/components'

interface AcademicLoadStateProps {
  title?: string
  message?: string
  retrying?: boolean
  onRetry: () => void
}

interface AcademicCacheNoticeProps {
  updatedAt: number
}

const formatCacheTime = (timestamp: number) => {
  const date = new Date(timestamp)
  if (!timestamp || Number.isNaN(date.getTime())) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function AcademicLoadState({
  title = '暂时没连上教务系统',
  message = '可以稍后再试，已有数据不会受影响',
  retrying = false,
  onRetry,
}: AcademicLoadStateProps) {
  return (
    <View className='academic-load-state'>
      <View className='academic-load-state__mark'>!</View>
      <Text className='academic-load-state__title'>{title}</Text>
      <Text className='academic-load-state__copy'>{message}</Text>
      <View
        className={`academic-load-state__action ${retrying ? 'academic-load-state__action--disabled' : ''}`}
        hoverClass={retrying ? 'none' : 'academic-load-state__action--pressed'}
        onClick={() => {
          if (!retrying) onRetry()
        }}
      >
        {retrying ? '正在重试…' : '重新加载'}
      </View>
    </View>
  )
}

export function AcademicCacheNotice({ updatedAt }: AcademicCacheNoticeProps) {
  const label = formatCacheTime(updatedAt)
  if (!label) return null
  return (
    <View className='academic-cache-notice'>
      <View />
      <Text>已展示上次数据 · {label}</Text>
    </View>
  )
}
