import Taro from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import { AcademicCredentialMissingError } from '../../../api/academic-credential'
import { isApiError } from '../../../api/client'

interface AcademicLoadStateProps {
  title?: string
  message?: string
  error?: unknown
  retrying?: boolean
  onRetry: () => void
}

interface AcademicCacheNoticeProps {
  updatedAt: number
  error?: unknown
}

const formatCacheTime = (timestamp: number) => {
  const date = new Date(timestamp)
  if (!timestamp || Number.isNaN(date.getTime())) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

type AcademicLoadAction = 'retry' | 'rebind'

export interface AcademicLoadErrorState {
  title: string
  message: string
  action: AcademicLoadAction
  actionLabel: string
}

const retryState = (message = '可以稍后再试，已有数据不会受影响'): AcademicLoadErrorState => ({
  title: '暂时没连上教务系统',
  message,
  action: 'retry',
  actionLabel: '重新加载',
})

export const resolveAcademicLoadError = (error: unknown): AcademicLoadErrorState => {
  if (error instanceof AcademicCredentialMissingError) {
    return {
      title: '本机没有可用教务账号',
      message: '请重新绑定教务账号后再查询。',
      action: 'rebind',
      actionLabel: '绑定教务账号',
    }
  }
  if (!isApiError(error)) {
    return retryState()
  }
  switch (error.code) {
    case 'invalid_academic_credentials':
      return {
        title: '教务账号或密码错误',
        message: '本机保存的教务凭据已被校方拒绝，请确认账号密码后更新。',
        action: 'rebind',
        actionLabel: '更新教务账号',
      }
    case 'academic_password_expired':
      return {
        title: '统一认证密码已过期',
        message: '请先在校方统一身份认证系统修改密码，再回来更新本机保存的密码。',
        action: 'rebind',
        actionLabel: '更新本机密码',
      }
    case 'academic_challenge_required':
      return {
        title: '校方要求额外验证',
        message: '请完成校方验证码或设备确认后，重新绑定教务账号。',
        action: 'rebind',
        actionLabel: '重新绑定',
      }
    case 'academic_identity_mismatch':
      return {
        title: '教务账号与当前身份不一致',
        message: error.message,
        action: 'rebind',
        actionLabel: '重新绑定',
      }
    case 'academic_provider_busy':
      return retryState('当前查询人数较多，请稍后再试。')
    default:
      return retryState(error.message || undefined)
  }
}

export function AcademicLoadState({
  title,
  message,
  error,
  retrying = false,
  onRetry,
}: AcademicLoadStateProps) {
  const state = resolveAcademicLoadError(error)
  const resolvedTitle = title || state.title
  const resolvedMessage = message || state.message
  const handleAction = () => {
    if (state.action === 'retry') {
      onRetry()
      return
    }
    Taro.navigateTo({ url: '/pages/academic-verification/index?rebind=1' })
      .catch(() => Taro.showToast({ title: '暂时无法打开账号更新页', icon: 'none' }))
  }
  return (
    <View className='academic-load-state'>
      <View className='academic-load-state__mark'>!</View>
      <Text className='academic-load-state__title'>{resolvedTitle}</Text>
      <Text className='academic-load-state__copy'>{resolvedMessage}</Text>
      <View
        className={`academic-load-state__action ${retrying ? 'academic-load-state__action--disabled' : ''}`}
        hoverClass={retrying ? 'none' : 'academic-load-state__action--pressed'}
        onClick={() => {
          if (!retrying) handleAction()
        }}
      >
        {retrying ? '正在重试…' : state.actionLabel}
      </View>
    </View>
  )
}

export function AcademicCacheNotice({ updatedAt, error }: AcademicCacheNoticeProps) {
  const label = formatCacheTime(updatedAt)
  if (!label) return null
  const errorState = error ? resolveAcademicLoadError(error) : null
  return (
    <View className='academic-cache-notice'>
      <View />
      <Text>
        {errorState ? `${errorState.title} · ` : ''}已展示上次数据 · {label}
      </Text>
    </View>
  )
}
