import { resolveMiniappModule, type MiniappRuntimeConfig, type MiniappModuleKey } from '../runtime-config'

/** LIFE_SERVICE_PUBLICATION_TYPES 列出统一发布器支持的业务类型。 */
export const LIFE_SERVICE_PUBLICATION_TYPES = ['community', 'errands', 'market', 'carpool'] as const
export type LifeServicePublicationType = typeof LIFE_SERVICE_PUBLICATION_TYPES[number]

/** lifeServicePublicationModules 维护发布类型到运行时模块的唯一映射。 */
export const lifeServicePublicationModules: Record<LifeServicePublicationType, MiniappModuleKey> = {
  community: 'community',
  errands: 'errand',
  market: 'marketplace',
  carpool: 'carpool',
}

/** availableLifeServicePublicationTypes 返回当前版本可查看和发布的生活服务类型。 */
export const availableLifeServicePublicationTypes = (config: MiniappRuntimeConfig) => (
  LIFE_SERVICE_PUBLICATION_TYPES.filter((type) => (
    resolveMiniappModule(config, lifeServicePublicationModules[type]).state === 'enabled'
  ))
)

/** normalizeLifeServicePublicationType 将失效类型回退到第一个可用类型。 */
export const normalizeLifeServicePublicationType = (
  requested: LifeServicePublicationType | undefined,
  config: MiniappRuntimeConfig,
) => {
  const available = availableLifeServicePublicationTypes(config)
  return requested && available.includes(requested) ? requested : available[0] || null
}

/** isLifeServicePublicationTypeAvailable 判断发布类型是否在当前版本可用。 */
export const isLifeServicePublicationTypeAvailable = (
  type: LifeServicePublicationType,
  config: MiniappRuntimeConfig,
) => availableLifeServicePublicationTypes(config).includes(type)

/** resolveLifeServicePublicationTarget 将不可用的发布目标回退到首个可用类型。 */
export const resolveLifeServicePublicationTarget = (
  requested: LifeServicePublicationType,
  config: MiniappRuntimeConfig,
) => (
  isLifeServicePublicationTypeAvailable(requested, config)
    ? requested
    : availableLifeServicePublicationTypes(config)[0] || null
)

/** lifeServiceModuleAvailabilitySignature 返回生活服务模块的可用性签名。 */
export const lifeServiceModuleAvailabilitySignature = (config: MiniappRuntimeConfig) => (
  ['community', 'errand', 'marketplace', 'carpool']
    .map((key) => resolveMiniappModule(config, key as MiniappModuleKey).state)
    .join(':')
)

/** lifeServiceModuleForPublicationType 返回发布类型对应的运行时模块键。 */
export const lifeServiceModuleForPublicationType = (type: LifeServicePublicationType) => lifeServicePublicationModules[type]

/** availableLifeServiceOrderTypes 返回当前配置允许查询的订单筛选类型。 */
export const availableLifeServiceOrderTypes = (config: MiniappRuntimeConfig) => {
  const marketplace = resolveMiniappModule(config, 'marketplace').state === 'enabled'
  const errand = resolveMiniappModule(config, 'errand').state === 'enabled'
  return [
    ...(marketplace && errand ? ['all'] as const : []),
    ...(marketplace ? ['marketplace'] as const : []),
    ...(errand ? ['errand'] as const : []),
  ]
}
