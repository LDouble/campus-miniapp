import Taro from '@tarojs/taro'

export type CampusTheme = 'light' | 'dark'
type ThemeListener = (theme: CampusTheme) => void

let systemTheme: CampusTheme | undefined
let publishedTheme: CampusTheme | undefined
let themeListenerInstalled = false
const listeners = new Set<ThemeListener>()
const isCampusTheme = (value: unknown): value is CampusTheme => value === 'light' || value === 'dark'

export const getCampusTheme = (): CampusTheme => {
  if (systemTheme) return systemTheme

  try {
    const appBaseInfo = typeof Taro.getAppBaseInfo === 'function'
      ? Taro.getAppBaseInfo()
      : undefined
    if (isCampusTheme(appBaseInfo?.theme)) {
      systemTheme = appBaseInfo.theme
      return systemTheme
    }
  } catch {
    // 部分基础库在首帧还未准备好 AppBaseInfo，继续尝试兼容 API。
  }

  try {
    const systemInfo = typeof Taro.getSystemInfoSync === 'function'
      ? Taro.getSystemInfoSync()
      : undefined
    if (isCampusTheme(systemInfo?.theme)) {
      systemTheme = systemInfo.theme
      return systemTheme
    }
  } catch {
    // 兼容 API 不可用时回退浅色，但不缓存回退值，避免遮蔽后续主题读取。
  }

  return 'light'
}

const publishTheme = (theme: CampusTheme) => {
  if (publishedTheme === theme) return
  publishedTheme = theme
  listeners.forEach((listener) => listener(theme))
}

export const initializeCampusTheme = () => {
  if (!themeListenerInstalled && typeof Taro.onThemeChange === 'function') {
    Taro.onThemeChange(({ theme }) => {
      if (!isCampusTheme(theme)) return
      systemTheme = theme
      publishTheme(theme)
    })
    themeListenerInstalled = true
  }
  const theme = getCampusTheme()
  publishTheme(theme)
  return theme
}

export const refreshCampusTheme = () => {
  systemTheme = undefined
  const theme = getCampusTheme()
  publishTheme(theme)
  return theme
}

export const subscribeCampusTheme = (listener: ThemeListener) => {
  listeners.add(listener)
  listener(getCampusTheme())
  return () => { listeners.delete(listener) }
}
