export const ACTIVITY_POPUP_CUSTOM_MINI_PROGRAM_APP_ID = 'wxaf35009675aa0b2a'
export const ACTIVITY_POPUP_MINI_PROGRAM_PATH_MAX_LENGTH = 2048

export type ActivityPopupMiniProgramTarget = {
  appId: string
  envVersion: 'develop' | 'trial' | 'release'
  requiresDeclaredAppId: boolean
  requiresPath: boolean
  requiresSafePath: boolean
}

export const activityPopupMiniProgramTargets: Record<string, ActivityPopupMiniProgramTarget> = {
  full_miniapp: {
    appId: __CAMPUS_TARGET_WECHAT_APP_ID__.trim(),
    envVersion: __CAMPUS_TARGET_MINIAPP_ENV_VERSION__ === 'develop'
      ? 'develop'
      : __CAMPUS_TARGET_MINIAPP_ENV_VERSION__ === 'trial'
        ? 'trial'
        : 'release',
    requiresDeclaredAppId: false,
    requiresPath: false,
    requiresSafePath: false,
  },
  custom_miniapp: {
    appId: ACTIVITY_POPUP_CUSTOM_MINI_PROGRAM_APP_ID,
    envVersion: 'release',
    requiresDeclaredAppId: true,
    requiresPath: true,
    requiresSafePath: true,
  },
}

export const activityPopupMiniProgramAppIds = () => {
  const appIds = [...new Set(
    Object.values(activityPopupMiniProgramTargets)
      .map(({ appId }) => appId)
      .filter(Boolean),
  )]
  if (appIds.length > 10) {
    throw new Error('活动弹框跳转小程序名单不能超过微信限制的 10 个 AppID。')
  }
  return appIds
}
