import Taro from '@tarojs/taro'
import type { MigratedFeatureModule } from './index'

export type FullMiniappEnvVersion = 'develop' | 'trial' | 'release'

export type MigratedFeatureMeta = {
  label: string
  path: string
}

export const migratedFeatureMeta: Record<MigratedFeatureModule, MigratedFeatureMeta> = {
  community: {
    label: '校园社区',
    path: 'pages/community/index',
  },
  marketplace: {
    label: '校园二手',
    path: 'pages/community/index?section=market',
  },
  errand: {
    label: '校园跑腿',
    path: 'pages/community/index?section=errands',
  },
  carpool: {
    label: '校园找同行',
    path: 'pages/community/index?section=carpool',
  },
  course_materials: {
    label: '课程资料',
    path: 'pages/materials/index',
  },
  club: {
    label: '社团服务',
    path: 'pages/clubs/index',
  },
}

const defaultMigratedFeatureModule: MigratedFeatureModule = 'community'

const isMiniappPath = (value: string) => (
  value.startsWith('pages/')
  && !value.includes('\\')
)

const normalizeMiniappPath = (value: string) => value.trim().replace(/^\/+/, '')

const resolveEnvVersion = (): FullMiniappEnvVersion => {
  if (__CAMPUS_TARGET_MINIAPP_ENV_VERSION__ === 'develop') return 'develop'
  if (__CAMPUS_TARGET_MINIAPP_ENV_VERSION__ === 'trial') return 'trial'
  return 'release'
}

export const resolveMigratedFeatureModule = (value?: string): MigratedFeatureModule => (
  value && value in migratedFeatureMeta
    ? value as MigratedFeatureModule
    : defaultMigratedFeatureModule
)

export const resolveFullMiniappPath = (
  module: MigratedFeatureModule,
  path?: string,
) => {
  const normalizedPath = path ? normalizeMiniappPath(path) : ''
  if (normalizedPath && isMiniappPath(normalizedPath)) return normalizedPath

  if (module === defaultMigratedFeatureModule) {
    const configuredDefaultPath = normalizeMiniappPath(__CAMPUS_TARGET_DEFAULT_PATH__)
    if (isMiniappPath(configuredDefaultPath)) return configuredDefaultPath
  }

  return migratedFeatureMeta[module].path
}

export type OpenFullMiniappOptions = {
  module: MigratedFeatureModule
  path?: string
}

export const featureMigratedUrl = ({
  module,
  path,
}: OpenFullMiniappOptions) => {
  const query = [`module=${encodeURIComponent(module)}`]
  if (path) query.push(`path=${encodeURIComponent(path)}`)
  return `/pages/feature-migrated/index?${query.join('&')}`
}

export const openMigratedFeaturePage = (options: OpenFullMiniappOptions) => (
  Taro.navigateTo({ url: featureMigratedUrl(options) })
)

export const openFullMiniapp = async ({
  module,
  path,
}: OpenFullMiniappOptions): Promise<boolean> => {
  const appId = __CAMPUS_TARGET_WECHAT_APP_ID__.trim()
  if (!appId) {
    Taro.showToast({ title: '新版小程序配置缺失，请联系管理员', icon: 'none' })
    return false
  }

  try {
    await Taro.navigateToMiniProgram({
      appId,
      path: resolveFullMiniappPath(module, path),
      envVersion: resolveEnvVersion(),
      extraData: {
        source: 'qualification',
        module,
      },
    })
    return true
  } catch (error) {
    Taro.showToast({ title: '暂时无法打开新版小程序，请稍后重试', icon: 'none' })
    return false
  }
}
