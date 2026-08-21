import { useEffect, useState } from 'react'
import { Text, View } from '@tarojs/components'
import { isApiError } from '../../../api/client'
import type { AcademicCacheMetadata } from '../../../api/types'
import {
  academicBindingGuidance,
  isAcademicBindingRequiredError,
  openAcademicCredentialBinding,
} from '../../../features/academic-verification/binding-guidance'
import { resolveAcademicCacheNotice } from './academic-cache-notice'

interface AcademicLoadStateProps {
  title?: string
  message?: string
  error?: unknown
  retrying?: boolean
  onRetry: () => void
}

interface AcademicCacheNoticeProps {
  cache?: AcademicCacheMetadata | null
  updatedAt?: number
  localUpdatedAt?: number
  localFallback?: boolean
}

type AcademicLoadAction = 'retry' | 'rebind'
const UPDATED_NOTICE_DURATION = 5000

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
  if (isAcademicBindingRequiredError(error)) {
    return {
      title: academicBindingGuidance.title,
      message: academicBindingGuidance.message,
      action: 'rebind',
      actionLabel: academicBindingGuidance.actionLabel,
    }
  }
  if (!isApiError(error)) {
    return retryState()
  }
  switch (error.code) {
    case 'invalid_academic_credentials':
      return {
        title: '教务账号或密码错误',
        message: '请访问信息门户 my.ouc.edu.cn 确认或修改密码，再回来更新本机密码。',
        action: 'rebind',
        actionLabel: '更新教务账号',
      }
    case 'academic_password_expired':
      return {
        title: '统一认证密码已过期',
        message: '请访问信息门户 my.ouc.edu.cn 修改密码，再回来更新本机保存的密码。',
        action: 'rebind',
        actionLabel: '更新本机密码',
      }
    case 'academic_account_restricted':
      return {
        title: '校方账号已锁定或冻结',
        message: '请访问信息门户 my.ouc.edu.cn 处理账号状态并修改密码，再回来更新本机密码。',
        action: 'rebind',
        actionLabel: '解锁后重新绑定',
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
    void openAcademicCredentialBinding()
  }
  return (
    <View className='academic-load-state'>
      <View className='academic-load-state__mark'>!</View>
      <Text className='academic-load-state__title'>{resolvedTitle}</Text>
      <Text className='academic-load-state__copy'>{resolvedMessage}</Text>
      <View
        className={`academic-load-state__action ${retrying ? 'academic-load-state__action--disabled' : ''}`}
        onClick={() => {
          if (!retrying) handleAction()
        }}
      >
        {retrying ? '正在重试…' : state.actionLabel}
      </View>
    </View>
  )
}

export function AcademicCacheNotice({
  cache,
  updatedAt = 0,
  localUpdatedAt = 0,
  localFallback = false,
}: AcademicCacheNoticeProps) {
  const [now, setNow] = useState(Date.now)
  const [visibleUpdatedAt, setVisibleUpdatedAt] = useState(updatedAt)
  const notice = resolveAcademicCacheNotice({
    cache,
    updatedAt: visibleUpdatedAt,
    localUpdatedAt,
    localFallback,
    now,
  })
  const refreshAt = notice?.kind === 'fresh' ? notice.refreshAt : undefined

  useEffect(() => {
    if (!refreshAt) return undefined
    const timer = setTimeout(() => setNow(Date.now()), Math.max(refreshAt - Date.now(), 0))
    return () => clearTimeout(timer)
  }, [refreshAt])

  useEffect(() => {
    setVisibleUpdatedAt(updatedAt)
    if (!updatedAt) return undefined
    const timer = setTimeout(() => {
      setVisibleUpdatedAt((current) => current === updatedAt ? 0 : current)
    }, UPDATED_NOTICE_DURATION)
    return () => clearTimeout(timer)
  }, [updatedAt])

  if (!notice) return null
  return (
    <View className={`academic-cache-notice academic-cache-notice--${notice.kind}`}>
      <View />
      <Text>{notice.message}</Text>
    </View>
  )
}
