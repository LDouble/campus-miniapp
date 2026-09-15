import { Text, View } from '@tarojs/components'
import { useDidShow, useLoad } from '@tarojs/taro'
import { useState } from 'react'
import CustomNavbar from '../../components/custom-navbar'
import {
  openFullMiniapp,
  resolveFullMiniappPath,
  resolveMigratedFeatureModule,
  type OpenFullMiniappOptions,
} from '../../features/app-edition/navigation'
import {
  getMigrationGuideCopy,
  getMiniappRuntimeConfig,
  loadMiniappRuntimeConfig,
} from '../../features/runtime-config'
import './index.scss'

export default function FeatureMigratedPage() {
  const [target, setTarget] = useState<OpenFullMiniappOptions>({
    module: 'community',
  })
  const [runtimeConfig, setRuntimeConfig] = useState(getMiniappRuntimeConfig)
  const migrationGuide = getMigrationGuideCopy(runtimeConfig)

  useLoad((options) => {
    const module = resolveMigratedFeatureModule(options.module)
    setTarget({
      module,
      path: resolveFullMiniappPath(module, options.path),
    })
  })

  useDidShow(() => {
    void loadMiniappRuntimeConfig().then(setRuntimeConfig)
  })

  const openNewMiniapp = () => {
    void openFullMiniapp(target)
  }

  return (
    <View className='feature-migrated'>
      <CustomNavbar title='服务迁移' showBack />
      <View className='feature-migrated__content'>
        <View className='feature-migrated__card'>
          <View className='feature-migrated__mark'>↗</View>
          <Text className='feature-migrated__title'>{migrationGuide.title}</Text>
          <Text className='feature-migrated__message'>{migrationGuide.description}</Text>
          <View
            className='feature-migrated__action'
            ariaRole='button'
            ariaLabel={migrationGuide.open_button_text}
            onClick={openNewMiniapp}
          >
            {migrationGuide.open_button_text}
          </View>
          <Text className='feature-migrated__hint'>{migrationGuide.hint}</Text>
        </View>
      </View>
    </View>
  )
}
