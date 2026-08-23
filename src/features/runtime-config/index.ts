import Taro from '@tarojs/taro'
import { apiRequest } from '../../api/client'
import type { components } from '../../api/generated/schema'
import { apiDateTimeTimestamp } from '../../utils/date-time'
import { requestWechatSubscription } from '../wechat-subscription/request'
import {
  DEFAULT_MIGRATION_GUIDE_COPY,
  normalizeMigrationGuideCopy,
  type MigrationGuideCopy,
} from '../app-edition/migration-copy'

export type CampusSection = {
  start: string
  end: string
}

export type CampusRuntimeConfig = {
  enabled: boolean
  sections: Record<string, CampusSection>
  features: Record<string, boolean>
}

export type RuntimeBanner = {
  id: string
  title: string
  subtitle: string
  image_url: string
  campuses: string[]
  action: {
    type: '' | 'none' | 'miniapp_path' | 'webview'
    value: string
  }
  priority: number
  starts_at: string
  ends_at: string
  enabled: boolean
}

export type RuntimeSlogan = {
  id: string
  title: string
  subtitle: string
  campuses: string[]
  priority: number
  enabled: boolean
}

export const MINIAPP_MODULE_KEYS = [
  'academic_schedule',
  'academic_grades',
  'academic_exams',
  'academic_selection',
  'academic_statistics',
  'calendar',
  'community',
  'marketplace',
  'errand',
  'carpool',
  'course_materials',
  'empty_classroom',
  'shuttle',
  'club',
  'private_message',
] as const

export type MiniappModuleKey = typeof MINIAPP_MODULE_KEYS[number]
export type MiniappModuleState = 'enabled' | 'maintenance' | 'hidden'

export type MiniappModuleConfig = {
  state: MiniappModuleState
  message?: string
}

export type MiniappRuntimeConfig = {
  schema_version: 1
  title: string
  effective_since: string
  default_campus: string
  campus_order: string[]
  campuses: Record<string, CampusRuntimeConfig>
  notes: Record<string, string>
  modules: Record<MiniappModuleKey, MiniappModuleConfig>
  subscription_templates: Partial<Record<MiniappModuleKey, string[]>>
  slogan_interval_ms: number
  slogans: RuntimeSlogan[]
  banners: RuntimeBanner[]
  migration_guide: MigrationGuideCopy
}

type RuntimeConfigView = components['schemas']['RuntimeConfig']

type StoredRuntimeConfig = {
  version: 1
  serverVersion: number
  updatedAt: number
  value: MiniappRuntimeConfig
}

const CONFIG_STORAGE_KEY = 'campus.miniapp.runtimeConfig.v1'
export const CAMPUS_STORAGE_KEY = 'campus.home.campus.v1'
const CONFIG_FRESH_MS = 60_000

const sharedSections: Record<string, CampusSection> = {
  1: { start: '08:00', end: '08:50' },
  2: { start: '09:00', end: '09:50' },
  3: { start: '10:10', end: '11:00' },
  4: { start: '11:10', end: '12:00' },
  5: { start: '13:30', end: '14:20' },
  6: { start: '14:30', end: '15:20' },
  7: { start: '15:30', end: '16:20' },
  8: { start: '16:30', end: '17:20' },
  9: { start: '17:30', end: '18:20' },
  10: { start: '18:30', end: '19:20' },
  11: { start: '19:30', end: '20:20' },
  12: { start: '20:30', end: '21:20' },
}

const defaultFeatures = {
  campus_card: true,
  classroom: true,
  shuttle: true,
  study_room: true,
}

const enabledModules = Object.fromEntries(
  MINIAPP_MODULE_KEYS.map((key) => [key, { state: 'enabled' }]),
) as Record<MiniappModuleKey, MiniappModuleConfig>

const conservativeModules: Record<MiniappModuleKey, MiniappModuleConfig> = {
  ...enabledModules,
  community: { state: 'hidden' },
  marketplace: { state: 'hidden' },
  errand: { state: 'hidden' },
  carpool: { state: 'hidden' },
  course_materials: { state: 'hidden' },
  club: { state: 'hidden' },
  private_message: { state: 'hidden' },
}

export const DEFAULT_MINIAPP_RUNTIME_CONFIG: MiniappRuntimeConfig = {
  schema_version: 1,
  title: '中国海洋大学上课时间表',
  effective_since: '2022秋季学期',
  default_campus: '崂山校区',
  campus_order: ['崂山校区', '鱼山校区', '西海岸校区'],
  campuses: {
    崂山校区: {
      enabled: true,
      sections: sharedSections,
      features: defaultFeatures,
    },
    鱼山校区: {
      enabled: true,
      sections: sharedSections,
      features: defaultFeatures,
    },
    西海岸校区: {
      enabled: true,
      sections: {
        ...sharedSections,
        1: { start: '08:30', end: '09:20' },
        2: { start: '09:25', end: '10:15' },
        3: { start: '10:30', end: '11:20' },
        4: { start: '11:25', end: '12:15' },
      },
      features: defaultFeatures,
    },
  },
  notes: {
    西海岸校区: '上午课间分别为5分钟和15分钟，下午、晚上与其他校区一致。',
    其他校区: '崂山校区与鱼山校区上课时间一致。',
  },
  modules: conservativeModules,
  subscription_templates: {},
  slogan_interval_ms: 5000,
  slogans: [
    {
      id: 'brand-ocean',
      title: '海纳百川，取则行远',
      subtitle: '一站式连接海大学习与生活',
      campuses: [],
      priority: 100,
      enabled: true,
    },
    {
      id: 'study-today',
      title: '今天也要认真上课',
      subtitle: '课表、成绩与校园服务触手可及',
      campuses: [],
      priority: 90,
      enabled: true,
    },
    {
      id: 'west-coast',
      title: '山海相逢，青春正好',
      subtitle: '西海岸校区专属校园服务已就绪',
      campuses: ['西海岸校区'],
      priority: 80,
      enabled: true,
    },
  ],
  banners: [
    {
      id: 'west-coast-guide-demo',
      title: '西海岸校区服务指南',
      subtitle: '校车、空教室与校园生活服务一站直达',
      image_url: '',
      campuses: ['西海岸校区'],
      action: {
        type: 'miniapp_path',
        value: '/pages/services/index',
      },
      priority: 100,
      starts_at: '',
      ends_at: '',
      enabled: true,
    },
  ],
  migration_guide: DEFAULT_MIGRATION_GUIDE_COPY,
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  !!value && typeof value === 'object' && !Array.isArray(value)
)

const isClock = (value: unknown) => (
  typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
)

const isCampus = (value: unknown): value is CampusRuntimeConfig => {
  if (!isRecord(value) || typeof value.enabled !== 'boolean') return false
  if (!isRecord(value.sections) || !isRecord(value.features)) return false
  const sections = value.sections
  const validSections = Array.from({ length: 12 }, (_, index) => String(index + 1))
    .every((key) => {
      const section = sections[key]
      return isRecord(section) && isClock(section.start) && isClock(section.end)
    })
  return validSections && Object.values(value.features)
    .every((enabled) => typeof enabled === 'boolean')
}

const isBanner = (value: unknown): value is RuntimeBanner => {
  if (!isRecord(value) || !isRecord(value.action)) return false
  return (
    typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.subtitle === 'string'
    && typeof value.image_url === 'string'
    && Array.isArray(value.campuses)
    && value.campuses.every((campus) => typeof campus === 'string')
    && typeof value.action.type === 'string'
    && typeof value.action.value === 'string'
    && typeof value.priority === 'number'
    && typeof value.starts_at === 'string'
    && typeof value.ends_at === 'string'
    && typeof value.enabled === 'boolean'
  )
}

const isSlogan = (value: unknown): value is RuntimeSlogan => {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.subtitle === 'string'
    && Array.isArray(value.campuses)
    && value.campuses.every((campus) => typeof campus === 'string')
    && typeof value.priority === 'number'
    && typeof value.enabled === 'boolean'
  )
}

const isModuleConfig = (value: unknown): value is MiniappModuleConfig => (
  isRecord(value)
  && ['enabled', 'maintenance', 'hidden'].includes(String(value.state))
  && (value.message === undefined || typeof value.message === 'string')
)

export const normalizeMiniappModules = (
  value: unknown,
): Record<MiniappModuleKey, MiniappModuleConfig> => {
  if (!isRecord(value)) return conservativeModules
  return Object.fromEntries(MINIAPP_MODULE_KEYS.map((key) => [
    key,
    isModuleConfig(value[key]) ? value[key] : conservativeModules[key],
  ])) as Record<MiniappModuleKey, MiniappModuleConfig>
}

const normalizeSubscriptionTemplates = (
  value: unknown,
): Partial<Record<MiniappModuleKey, string[]>> => {
  if (!isRecord(value)) return {}
  return Object.fromEntries(
    MINIAPP_MODULE_KEYS.flatMap((key) => {
      const rawTemplateIDs = value[key]
      if (!Array.isArray(rawTemplateIDs)) return []
      const templateIDs = Array.from(new Set(rawTemplateIDs
        .filter((id): id is string => typeof id === 'string')
        .map((id) => id.trim())
        .filter((id) => id.length > 0 && id.length <= 128)))
        .slice(0, 3)
      return templateIDs.length > 0 ? [[key, templateIDs]] : []
    }),
  )
}

const isSubscriptionTemplates = (value: unknown) => (
  isRecord(value)
  && Object.entries(value).every(([key, templateIDs]) => (
    MINIAPP_MODULE_KEYS.includes(key as MiniappModuleKey)
    && Array.isArray(templateIDs)
    && templateIDs.length <= 3
    && templateIDs.every((id) => (
      typeof id === 'string'
      && id.trim().length > 0
      && id.length <= 128
    ))
  ))
)

const isRuntimeConfig = (value: unknown): value is MiniappRuntimeConfig => {
  if (!isRecord(value)) return false
  if (
    value.schema_version !== 1
    || typeof value.title !== 'string'
    || typeof value.effective_since !== 'string'
    || typeof value.default_campus !== 'string'
    || !Array.isArray(value.campus_order)
    || !isRecord(value.campuses)
    || !isRecord(value.notes)
    || (value.modules !== undefined && !isRecord(value.modules))
    || (value.subscription_templates !== undefined
      && !isSubscriptionTemplates(value.subscription_templates))
    || typeof value.slogan_interval_ms !== 'number'
    || !Array.isArray(value.slogans)
    || !Array.isArray(value.banners)
  ) return false
  const campusNames = value.campus_order
  const campuses = value.campuses
  return (
    campusNames.length > 0
    && campusNames.every((name) => (
      typeof name === 'string' && isCampus(campuses[name])
    ))
    && campusNames.includes(value.default_campus)
    && value.slogans.length > 0
    && value.slogans.every(isSlogan)
    && value.banners.every(isBanner)
    && (value.modules === undefined || Object.entries(value.modules)
      .every(([key, module]) => (
        MINIAPP_MODULE_KEYS.includes(key as MiniappModuleKey)
        && isModuleConfig(module)
      )))
  )
}

const normalizeRuntimeConfig = (
  value: MiniappRuntimeConfig,
): MiniappRuntimeConfig => ({
  ...value,
  modules: normalizeMiniappModules(value.modules),
  subscription_templates: normalizeSubscriptionTemplates(value.subscription_templates),
  migration_guide: normalizeMigrationGuideCopy(value.migration_guide),
})

export const getMigrationGuideCopy = (
  config: MiniappRuntimeConfig,
): MigrationGuideCopy => (
  __CAMPUS_APP_EDITION__ === 'qualification'
    ? normalizeMigrationGuideCopy(config.migration_guide)
    : DEFAULT_MIGRATION_GUIDE_COPY
)

const storedRuntimeConfig = (): StoredRuntimeConfig | null => {
  try {
    const stored = Taro.getStorageSync<StoredRuntimeConfig>(CONFIG_STORAGE_KEY)
    if (stored && stored.version === 1 && isRuntimeConfig(stored.value)) {
      return {
        ...stored,
        value: normalizeRuntimeConfig(stored.value),
      }
    }
  } catch {
    // Storage failure falls back to the bundled bootstrap document.
  }
  return null
}

const cachedRuntimeConfig = () => (
  storedRuntimeConfig()?.value || DEFAULT_MINIAPP_RUNTIME_CONFIG
)

export const getMiniappRuntimeConfig = cachedRuntimeConfig

let pendingRequest: Promise<MiniappRuntimeConfig> | null = null

export const loadMiniappRuntimeConfig = (
  options: { force?: boolean } = {},
): Promise<MiniappRuntimeConfig> => {
  const stored = storedRuntimeConfig()
  if (
    !options.force
    && stored
    && Date.now() - stored.updatedAt < CONFIG_FRESH_MS
  ) {
    return Promise.resolve(stored.value)
  }
  if (pendingRequest) return pendingRequest
  let tracked: Promise<MiniappRuntimeConfig>
  tracked = apiRequest<RuntimeConfigView>({
    path: '/api/v1/runtime-configs/miniapp/bootstrap',
    anonymous: true,
  })
    .then((view) => {
      if (!isRuntimeConfig(view.value)) throw new Error('invalid miniapp runtime config')
      const value = normalizeRuntimeConfig(view.value)
      Taro.setStorageSync(CONFIG_STORAGE_KEY, {
        version: 1,
        serverVersion: Number(view.version) || 0,
        updatedAt: Date.now(),
        value,
      } as StoredRuntimeConfig)
      return value
    })
    .catch(cachedRuntimeConfig)
    .finally(() => {
      if (pendingRequest === tracked) pendingRequest = null
    })
  pendingRequest = tracked
  return tracked
}

const legacyCampusFeatureKeys: Partial<Record<MiniappModuleKey, string>> = {
  empty_classroom: 'classroom',
  shuttle: 'shuttle',
}

export const resolveMiniappModule = (
  config: MiniappRuntimeConfig,
  key: MiniappModuleKey,
  campusName = getSelectedCampus(config),
): MiniappModuleConfig => {
  const module = config.modules[key] || conservativeModules[key]
  if (module.state !== 'enabled') return module
  const features = config.campuses[campusName]?.features
  const legacyKey = legacyCampusFeatureKeys[key]
  if (
    features
    && (features[key] === false || (legacyKey && features[legacyKey] === false))
  ) {
    return { state: 'hidden' }
  }
  return module
}

export const visibleMiniappModule = (
  config: MiniappRuntimeConfig,
  key: MiniappModuleKey,
  campusName?: string,
) => resolveMiniappModule(config, key, campusName).state !== 'hidden'

export const openMiniappModule = async (
  key: MiniappModuleKey,
  url: string,
  options: {
    tab?: boolean
    config?: MiniappRuntimeConfig
    subscriptionAlreadyRequested?: boolean
  } = {},
) => {
  const config = options.config || getMiniappRuntimeConfig()
  const module = resolveMiniappModule(config, key)
  if (module.state === 'hidden') {
    await Taro.showToast({ title: '该功能暂未开放', icon: 'none' })
    return false
  }
  if (module.state === 'maintenance') {
    await Taro.navigateTo({
      url: `/pages/feature-unavailable/index?module=${key}&message=${encodeURIComponent(
        module.message || '功能维护中，请稍后再试',
      )}`,
    })
    return false
  }
  if (!options.subscriptionAlreadyRequested) {
    requestWechatSubscription(config.subscription_templates[key])
  }
  if (options.tab) await Taro.switchTab({ url })
  else await Taro.navigateTo({ url })
  return true
}

export const enabledCampuses = (config: MiniappRuntimeConfig) => (
  config.campus_order.filter((name) => {
    const campus = config.campuses[name]
    return campus && campus.enabled
  })
)

export const getSelectedCampus = (config: MiniappRuntimeConfig) => {
  const available = enabledCampuses(config)
  try {
    const saved = String(Taro.getStorageSync(CAMPUS_STORAGE_KEY) || '')
    if (available.includes(saved)) return saved
  } catch {
    // Use the configured default if local storage cannot be read.
  }
  if (available.includes(config.default_campus)) return config.default_campus
  return available[0] || config.default_campus
}

export const saveSelectedCampus = (campus: string) => {
  Taro.setStorageSync(CAMPUS_STORAGE_KEY, campus)
}

export const getCampusSections = (
  config: MiniappRuntimeConfig,
  campusName: string,
) => {
  const campus = config.campuses[campusName] || config.campuses[config.default_campus]
  return campus ? campus.sections : DEFAULT_MINIAPP_RUNTIME_CONFIG.campuses.崂山校区.sections
}

export const getSectionStartTime = (
  config: MiniappRuntimeConfig,
  campusName: string,
  section: number,
) => {
  const item = getCampusSections(config, campusName)[String(section)]
  return item ? item.start : ''
}

export const getSectionEndTime = (
  config: MiniappRuntimeConfig,
  campusName: string,
  section: number,
) => {
  const item = getCampusSections(config, campusName)[String(section)]
  return item ? item.end : ''
}

export const activeBanners = (
  config: MiniappRuntimeConfig,
  campusName: string,
  now = new Date(),
) => config.banners
  .filter((banner) => {
    if (!banner.enabled) return false
    if (banner.campuses.length && !banner.campuses.includes(campusName)) return false
    const startsAt = banner.starts_at ? apiDateTimeTimestamp(banner.starts_at) : 0
    const endsAt = banner.ends_at ? apiDateTimeTimestamp(banner.ends_at) : Number.MAX_SAFE_INTEGER
    return now.getTime() >= startsAt && now.getTime() < endsAt
  })
  .sort((left, right) => right.priority - left.priority)

export const activeSlogans = (
  config: MiniappRuntimeConfig,
  campusName: string,
) => config.slogans
  .filter((slogan) => (
    slogan.enabled
    && (!slogan.campuses.length || slogan.campuses.includes(campusName))
  ))
  .sort((left, right) => right.priority - left.priority)
