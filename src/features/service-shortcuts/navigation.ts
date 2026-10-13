import Taro from '@tarojs/taro'
import { isQualificationEdition } from '../app-edition'
import { openMigratedFeaturePage } from '../app-edition/navigation'
import { openMiniappModule, resolveMiniappModule, type MiniappRuntimeConfig } from '../runtime-config'
import { migratedServiceKeys, serviceModules, type ServiceItem } from './catalog'

const LIFE_HUB_SECTION_KEY = 'campus.lifeHub.section.v1'
export function openService(item: ServiceItem, runtimeConfig: MiniappRuntimeConfig) {
    const moduleKey = serviceModules[item.key]
    if (isQualificationEdition && migratedServiceKeys.has(item.key)) {
      const module = item.key === 'materials'
        ? 'course_materials'
        : item.key === 'market'
          ? 'marketplace'
          : item.key === 'errands'
            ? 'errand'
            : item.key === 'clubs'
              ? 'club'
              : item.key
      void openMigratedFeaturePage({
        module: module as 'community' | 'marketplace' | 'errand' | 'carpool' | 'course_materials' | 'club',
      })
      return
    }
    if (item.lifeSection) {
      if (
        moduleKey
        && resolveMiniappModule(runtimeConfig, moduleKey).state === 'enabled'
      ) {
        Taro.setStorageSync(LIFE_HUB_SECTION_KEY, item.lifeSection)
      }
      if (moduleKey) {
        void openMiniappModule(
          moduleKey,
          '/pages/community/index',
          { tab: true, config: runtimeConfig },
        )
      }
      return
    }
    if (item.tab) {
      Taro.switchTab({ url: item.tab })
      return
    }
    if (item.route) {
      if (moduleKey) {
        void openMiniappModule(moduleKey, item.route, { config: runtimeConfig })
        return
      }
      Taro.navigateTo({ url: item.route })
      return
    }
    Taro.showToast({ title: `${item.name}入口配置异常`, icon: 'none' })

}
