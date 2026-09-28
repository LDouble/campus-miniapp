import Taro from '@tarojs/taro'
import type { ActivityPopupAction } from '../../api/activity-popups'

type InternalTarget = {
  path: string
  allowedParams: readonly string[]
}

const internalTargets: Record<string, InternalTarget> = {
  calendar: { path: '/pages/calendar/index', allowedParams: [] },
  course_schedule: { path: '/pages/academic/schedule/index', allowedParams: ['mode'] },
  daily_checkin: { path: '/pages/daily-checkin/index', allowedParams: [] },
  official_notices: { path: '/pages/official-notices/index', allowedParams: [] },
  official_notice: { path: '/pages/official-notices/detail', allowedParams: ['id'] },
  services: { path: '/pages/services/index', allowedParams: [] },
  today_hot: { path: '/pages/today-hot/index', allowedParams: ['snapshot_id', 'post_id'] },
}

const miniProgramTargets: Record<string, {
  appId: string
  allowedParams: readonly string[]
  envVersion: 'develop' | 'trial' | 'release'
}> = {
  full_miniapp: {
    appId: __CAMPUS_TARGET_WECHAT_APP_ID__.trim(),
    allowedParams: ['path'],
    envVersion: __CAMPUS_TARGET_MINIAPP_ENV_VERSION__ === 'develop'
      ? 'develop'
      : __CAMPUS_TARGET_MINIAPP_ENV_VERSION__ === 'trial'
        ? 'trial'
        : 'release',
  },
}

const pickParams = (params: Record<string, string>, allowed: readonly string[]) => (
  Object.fromEntries(
    allowed.flatMap((key) => {
      const value = params[key]
      return typeof value === 'string' && value.length > 0 && value.length <= 256
        ? [[key, value]]
        : []
    }),
  ) as Record<string, string>
)

const queryString = (params: Record<string, string>) => {
  const entries = Object.entries(params)
  return entries.length
    ? `?${entries.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&')}`
    : ''
}

export const openActivityPopupAction = async (action: ActivityPopupAction): Promise<boolean> => {
  if (action.type === 'internal_page') {
    const target = internalTargets[action.target_key]
    if (!target) return false
    await Taro.navigateTo({
      url: `${target.path}${queryString(pickParams(action.params || {}, target.allowedParams))}`,
    })
    return true
  }

  if (action.type === 'mini_program') {
    const target = miniProgramTargets[action.target_key]
    if (!target?.appId) return false
    const params = pickParams(action.params || {}, target.allowedParams)
    await Taro.navigateToMiniProgram({
      appId: target.appId,
      path: params.path || '',
      envVersion: target.envVersion,
      extraData: { source: 'activity_popup', target_key: action.target_key },
    })
    return true
  }

  return false
}

export const isActivityPopupActionSupported = (action: ActivityPopupAction) => (
  action.type === 'internal_page'
    ? Boolean(internalTargets[action.target_key])
    : action.type === 'mini_program'
      ? Boolean(miniProgramTargets[action.target_key]?.appId)
      : false
)
