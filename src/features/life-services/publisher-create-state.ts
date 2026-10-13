import type { MiniappRuntimeConfig } from '../runtime-config'
import {
  isLifeServicePublicationTypeAvailable,
  normalizeLifeServicePublicationType,
  type LifeServicePublicationType,
} from './module-availability'

/** resolvePublisherCreateSection 选择创建发布时当前配置允许的类型。 */
export const resolvePublisherCreateSection = (
  requested: LifeServicePublicationType,
  classDiscussionLocked: boolean,
  config: MiniappRuntimeConfig,
) => {
  if (classDiscussionLocked) {
    return isLifeServicePublicationTypeAvailable('community', config) ? 'community' : null
  }
  return normalizeLifeServicePublicationType(requested, config)
}

/** canPersistPublisherDraft 防止未恢复或已关闭模块的空表单覆盖现有草稿。 */
export const canPersistPublisherDraft = (createReady: boolean, sectionAvailable: boolean) => (
  createReady && sectionAvailable
)
