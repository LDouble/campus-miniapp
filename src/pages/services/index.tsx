import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import { useEffect, useRef, useState } from 'react'
import CustomNavbar from '../../components/custom-navbar'
import { isQualificationEdition } from '../../features/app-edition'
import { openMigratedFeaturePage } from '../../features/app-edition/navigation'
import { getMiniappRuntimeConfig, getMigrationGuideCopy, loadMiniappRuntimeConfig, resolveMiniappModule } from '../../features/runtime-config'
import { useCampusShare } from '../../features/share'
import { getCampusTheme, subscribeCampusTheme } from '../../features/system-theme'
import { allServices, migratedServiceKeys, serviceGroups, serviceModules, type ServiceItem } from '../../features/service-shortcuts/catalog'
import { openService } from '../../features/service-shortcuts/navigation'
import { MAX_SHORTCUTS, readShortcuts, saveShortcuts } from '../../features/service-shortcuts/preferences'
import ShortcutEditor from '../../features/service-shortcuts/editor'
import { getServiceIcon } from '../../features/service-shortcuts/icons'
import './index.scss'

export default function Services() {
  const router = useRouter()
  const suppressNavigationUntil = useRef(0)
  const [campusTheme, setCampusTheme] = useState(getCampusTheme)
  const [runtimeConfig, setRuntimeConfig] = useState(getMiniappRuntimeConfig)
  const [keys, setKeys] = useState(readShortcuts)
  const [editing, setEditing] = useState(router.params.edit === '1')
  const [draft, setDraft] = useState(readShortcuts)
  const startEditing = () => { setDraft([...keys]); setEditing(true) }
  const finishEditing = () => {
    if (!saveShortcuts(draft)) { void Taro.showToast({ title: '保存失败，请重试', icon: 'none' }); return }
    setKeys([...draft]); setEditing(false)
  }
  const toggleShortcut = (key: string) => {
    if (draft.includes(key)) { setDraft(draft.filter((value) => value !== key)); return }
    if (draft.length >= MAX_SHORTCUTS) { void Taro.showToast({ title: `最多选择${MAX_SHORTCUTS}项`, icon: 'none' }); return }
    setDraft([...draft, key])
  }
  useEffect(() => subscribeCampusTheme(setCampusTheme), [])
  useCampusShare(() => ({ title: 'OUSea服务｜学业、出行与校园生活', path: '/pages/services/index' }))
  useDidShow(() => { setKeys(readShortcuts()); void loadMiniappRuntimeConfig().then(setRuntimeConfig) })
  const available = allServices.filter((item) => {
    if (isQualificationEdition && migratedServiceKeys.has(item.key)) return false
    const module = serviceModules[item.key]
    return !module || resolveMiniappModule(runtimeConfig, module).state !== 'hidden'
  })
  const customizable = available.filter((item) => {
    const module = serviceModules[item.key]
    return !module || resolveMiniappModule(runtimeConfig, module).state === 'enabled'
  })
  const availableKeys = new Set(available.map((item) => item.key))
  const pinned = keys.map((key) => available.find((item) => item.key === key)).filter((item): item is ServiceItem => Boolean(item))
  const migrationGuide = getMigrationGuideCopy(runtimeConfig)
  const renderItem = (item: ServiceItem, variant: 'pinned' | 'category' = 'pinned') => (
    <View key={item.key} className={`services-item services-item--${item.key}`} ariaRole='button' ariaLabel={`打开${item.name}`} onLongPress={() => { if (variant === 'pinned') { suppressNavigationUntil.current = Date.now() + 800; startEditing() } }} onClick={() => { if (editing) { if (customizable.some((entry) => entry.key === item.key)) toggleShortcut(item.key); return } if (Date.now() >= suppressNavigationUntil.current) openService(item, runtimeConfig) }}>
      <View className={`services-icon services-icon--${getServiceIcon(item.key, campusTheme).tone}`}>
        <Image src={getServiceIcon(item.key, campusTheme).src} mode='aspectFit' />
        {editing && customizable.some((entry) => entry.key === item.key) && <View className={`services-toggle ${draft.includes(item.key) ? 'services-toggle--selected' : ''}`} ariaRole='button' ariaLabel={`${draft.includes(item.key) ? '移除' : '添加'}${item.name}`} onClick={(event) => { event.stopPropagation(); toggleShortcut(item.key) }}><Image src={getServiceIcon(draft.includes(item.key) ? 'edit-selected' : 'edit-add', campusTheme).src} mode='aspectFit' /></View>}
      </View>
      <Text className='services-item__name'>{item.name}</Text>
    </View>
  )
  return (
    <View className={`services-page ${editing ? 'services-page--editing' : ''}`}>
      <CustomNavbar title='全部服务' subtitle='中国海洋大学' showBack />
      <View className='services-page__content'>

        {editing && <View className='services-edit-notice'><View><Text className='services-edit-notice__title'>点击减号移出，下方点加号快速添加</Text><Text className='services-edit-notice__hint'>拖动可排序 · 已添加的服务在下方自动隐藏</Text></View><Text className='services-edit-notice__count'>{draft.length} / {MAX_SHORTCUTS} 项</Text></View>}
        <View className='services-group services-group--pinned'>
          <View className='services-group__head'>
            <View className='services-group__heading'><Text className='services-group__title'>我的常用</Text>{editing && <Text className='services-edit-capacity'>可放{MAX_SHORTCUTS}项</Text>}</View>
            <View className='services-edit-actions'>
              {editing && <View className='services-edit' ariaRole='button' onClick={() => setEditing(false)}>取消</View>}
              <View className={`services-edit ${editing ? 'services-edit--done' : ''}`} ariaRole='button' ariaLabel={editing ? '完成编辑' : '编辑常用服务'} onClick={editing ? finishEditing : startEditing}><Image src={editing ? require('../../assets/icons/services-stitch/edit-done.svg') : getServiceIcon('edit', campusTheme).src} mode='aspectFit' /><Text>{editing ? '完成' : '自定义'}</Text></View>
            </View>
          </View>
          <Text className='services-group__subtitle'>{editing ? `点击右上角减号即可移除 · 当前已选 ${draft.length} 项` : '长按拖拽排序或点击编辑'}</Text>
          {editing ? <ShortcutEditor keys={draft} available={customizable} theme={campusTheme} onChange={setDraft} /> : <View className='services-group__grid'>{pinned.map((item) => renderItem(item))}</View>}
          {!editing && pinned.length === 0 && <Text className='services-empty'>点击自定义，添加常用服务</Text>}
        </View>
        {serviceGroups.map((group, index) => {
          const items = group.items.filter((item) => availableKeys.has(item.key) && (!editing || (!draft.includes(item.key) && customizable.some((entry) => entry.key === item.key))))
          if (!items.length) return null
          return <View key={group.title} className={`services-group services-group--category-${index}`}>
            <View className='services-group__head'><View className='services-group__heading'><Text className='services-group__title'>{group.title}</Text>{editing && <Text className='services-pool-hint'>点击＋直接加入</Text>}</View><Text className='services-group__count'>{editing ? '剩余 ' : ''}{items.length} 项</Text></View>
            <View className='services-group__grid'>{items.map((item) => renderItem(item, 'category'))}</View>
          </View>
        })}
        {isQualificationEdition && <View className='services-migrated' onClick={() => void openMigratedFeaturePage({ module: 'community' })}><Text>{migrationGuide.title}</Text><Text>{migrationGuide.description}</Text><Text>{migrationGuide.entry_button_text}</Text></View>}
      </View>

    </View>
  )
}
