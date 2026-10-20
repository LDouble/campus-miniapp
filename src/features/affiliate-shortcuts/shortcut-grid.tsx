import { useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { Image, Text, View } from '@tarojs/components'
import type { AffiliateShortcutItem } from './config'
import { isAffiliateShortcutActive, isSafeAffiliateShortcutImage } from './config'
import { getAffiliateShortcutIconPresentation } from './icon-policy'
import './shortcut-grid.scss'

type ShortcutIconProps = {
  title: string
  url: string
}

function ShortcutIcon({ title, url }: ShortcutIconProps) {
  const [failed, setFailed] = useState(false)
  const safeUrl = isSafeAffiliateShortcutImage(url) ? url : ''
  const presentation = getAffiliateShortcutIconPresentation(url, failed)

  useEffect(() => setFailed(false), [safeUrl])

  if (presentation.isFallback) {
    return (
      <View className='affiliate-shortcuts__icon-fallback' ariaLabel={`${title}图标`}>
        <Image
          className='affiliate-shortcuts__icon affiliate-shortcuts__fallback-icon'
          src={presentation.src}
          mode='aspectFit'
        />
      </View>
    )
  }

  return (
    <Image
      className='affiliate-shortcuts__icon'
      src={presentation.src}
      mode='aspectFit'
      lazyLoad
      onError={() => setFailed(true)}
    />
  )
}

type ShortcutGridProps = {
  items: AffiliateShortcutItem[]
}

/** AffiliateShortcutGrid 按配置显示五列快捷入口并在点击时执行对应动作。 */
export default function AffiliateShortcutGrid({ items }: ShortcutGridProps) {
  const [launching, setLaunching] = useState<string[]>([])
  const launchingRef = useRef(new Set<string>())

  if (!items.length) return null

  const openItem = (item: AffiliateShortcutItem) => {
    if (!isAffiliateShortcutActive(item)) {
      setLaunching((current) => current.filter((id) => id !== item.id))
      Taro.showToast({ title: '这个入口已过展示时间，请刷新页面', icon: 'none' })
      return
    }
    if (item.action.type === 'copy_token') {
      void Taro.navigateTo({
        url: `/pages/goods/shortcut-copy?id=${encodeURIComponent(item.id)}`,
      })
      return
    }

    if (launchingRef.current.has(item.id)) return
    launchingRef.current.add(item.id)
    setLaunching((current) => [...current, item.id])
    const release = () => {
      launchingRef.current.delete(item.id)
      setLaunching((current) => current.filter((id) => id !== item.id))
    }
    try {
      // 直接在用户点击栈中调用微信跳转接口，避免异步读取配置破坏手势。
      void Taro.navigateToMiniProgram({
        appId: item.action.app_id,
        path: item.action.path,
        envVersion: item.action.env_version,
      }).then(release).catch((error: unknown) => {
        release()
        const message = error && typeof error === 'object' && 'errMsg' in error
          ? String(error.errMsg)
          : error instanceof Error ? error.message : String(error)
        if (/cancel/i.test(message)) return
        Taro.showToast({ title: '打开小程序失败，请检查入口配置后重试', icon: 'none' })
      })
    } catch {
      release()
      Taro.showToast({ title: '打开小程序失败，请检查入口配置后重试', icon: 'none' })
    }
  }

  return (
    <View className='affiliate-shortcuts' ariaLabel='快捷服务'>
      <View className='affiliate-shortcuts__grid'>
        {items.map((item) => (
          <View
            key={item.id}
            className={`affiliate-shortcuts__item ${launching.includes(item.id) ? 'affiliate-shortcuts__item--pending' : ''}`}
            ariaRole='button'
            ariaLabel={`${item.title}${item.badge ? `，${item.badge}` : ''}`}
            onClick={() => openItem(item)}
          >
            <View className='affiliate-shortcuts__visual'>
              <ShortcutIcon title={item.title} url={item.icon_url} />
              {item.badge && <Text className='affiliate-shortcuts__badge'>{item.badge}</Text>}
            </View>
            <Text className='affiliate-shortcuts__title'>{item.title}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}
