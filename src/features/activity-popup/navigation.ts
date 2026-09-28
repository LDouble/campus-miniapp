import Taro from '@tarojs/taro'
import type { ActivityPopupAction } from '../../api/activity-popups'
import {
  ACTIVITY_POPUP_MINI_PROGRAM_PATH_MAX_LENGTH,
  activityPopupMiniProgramTargets,
} from './mini-program-targets'

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

const isSafeCustomMiniProgramPath = (path: string) => (
  path.startsWith('/')
  && !path.startsWith('//')
  && !path.includes('..')
  && !/[\r\n\t]/u.test(path)
)

const resolveMiniProgramPath = (
  params: Record<string, string>,
  required: boolean,
  safePathRequired: boolean,
) => {
  const path = params.path
  if (path === undefined) return required ? null : ''
  // 后端按 Go rune、管理端按 Array.from 计数，客户端也以 Unicode code point 对齐。
  return typeof path === 'string' && Array.from(path).length <= ACTIVITY_POPUP_MINI_PROGRAM_PATH_MAX_LENGTH
    && (!required || path.length > 0)
    && (!safePathRequired || isSafeCustomMiniProgramPath(path))
    ? path
    : null
}

const resolveMiniProgramTarget = (action: ActivityPopupAction) => {
  const target = activityPopupMiniProgramTargets[action.target_key]
  if (!target?.appId) return null
  const params = action.params || {}
  if (target.requiresDeclaredAppId && params.app_id !== target.appId) return null
  const path = resolveMiniProgramPath(params, target.requiresPath, target.requiresSafePath)
  return path === null ? null : { target, path }
}

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
    const resolved = resolveMiniProgramTarget(action)
    if (!resolved) return false
    await Taro.navigateToMiniProgram({
      appId: resolved.target.appId,
      // 外部小程序按其页面协议解释 path；不能重新编码或截断后台传入值。
      path: resolved.path,
      envVersion: resolved.target.envVersion,
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
      ? Boolean(resolveMiniProgramTarget(action))
      : false
)
