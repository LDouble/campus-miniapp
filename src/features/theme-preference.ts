import Taro from '@tarojs/taro'

export type CampusTheme = 'light' | 'dark'
export type CampusThemePreference = 'system' | CampusTheme

export const CAMPUS_THEME_STORAGE_KEY = 'campus-theme-preference'

const themeColors = {
  light: {
    navigation: '#ffffff',
    page: '#f5f8fc',
    text: '#000000',
    backgroundTextStyle: 'dark' as const,
    tabText: '#90a1b9',
    tabSelected: '#2b7fff',
    tabBorder: 'white' as const,
  },
  dark: {
    navigation: '#111827',
    page: '#0b1220',
    text: '#ffffff',
    backgroundTextStyle: 'light' as const,
    tabText: '#94a3b8',
    tabSelected: '#60a5fa',
    tabBorder: 'black' as const,
  },
} as const

type ThemeListener = (theme: CampusTheme, preference: CampusThemePreference) => void
type RestartMiniProgramOptions = {
  path: string
  fail?: () => void
}
type WechatThemeRuntime = {
  restartMiniProgram?: (options: RestartMiniProgramOptions) => void
}

declare const wx: WechatThemeRuntime | undefined

let storedPreference: CampusThemePreference | undefined
let systemTheme: CampusTheme | undefined
let themeListenerInstalled = false
const listeners = new Set<ThemeListener>()

const isCampusTheme = (value: unknown): value is CampusTheme => (
  value === 'light' || value === 'dark'
)

const isCampusThemePreference = (value: unknown): value is CampusThemePreference => (
  value === 'system' || isCampusTheme(value)
)

const readStoredPreference = (): CampusThemePreference => {
  if (storedPreference !== undefined) return storedPreference
  try {
    const value = Taro.getStorageSync(CAMPUS_THEME_STORAGE_KEY)
    storedPreference = isCampusThemePreference(value) ? value : 'system'
  } catch {
    storedPreference = 'system'
  }
  return storedPreference
}

const readSystemTheme = (): CampusTheme => {
  if (systemTheme) return systemTheme
  try {
    const value = Taro.getAppBaseInfo().theme
    systemTheme = isCampusTheme(value) ? value : 'light'
  } catch {
    systemTheme = 'light'
  }
  return systemTheme
}

export const getCampusThemePreference = (): CampusThemePreference => readStoredPreference()

export const getCampusTheme = (): CampusTheme => {
  const preference = readStoredPreference()
  return preference === 'system' ? readSystemTheme() : preference
}

type ThemePageInstance = {
  setData?: (data: { __campusTheme: CampusTheme }) => void
}

export const applyCampusThemeToCurrentPage = (theme = getCampusTheme()) => {
  try {
    const pages = Taro.getCurrentPages() as ThemePageInstance[]
    pages.forEach((page) => page.setData?.({ __campusTheme: theme }))
  } catch {
    // App 启动早期页面实例可能尚未建立，页面挂载和 onShow 会再次同步。
  }
}

export const applyCampusThemeToNativeChrome = (theme = getCampusTheme()) => {
  const colors = themeColors[theme]

  if (typeof Taro.setNavigationBarColor === 'function') {
    void Taro.setNavigationBarColor({
      frontColor: colors.text,
      backgroundColor: colors.navigation,
    }).catch(() => undefined)
  }
  if (typeof Taro.setBackgroundColor === 'function') {
    void Taro.setBackgroundColor({
      backgroundColor: colors.page,
      backgroundColorTop: colors.page,
      backgroundColorBottom: colors.page,
    }).catch(() => undefined)
  }
  if (typeof Taro.setBackgroundTextStyle === 'function') {
    void Taro.setBackgroundTextStyle({
      textStyle: colors.backgroundTextStyle,
    }).catch(() => undefined)
  }
  if (typeof Taro.setTabBarStyle === 'function') {
    void Taro.setTabBarStyle({
      color: colors.tabText,
      selectedColor: colors.tabSelected,
      backgroundColor: colors.navigation,
      borderStyle: colors.tabBorder,
    }).catch(() => undefined)
  }
}

const publishTheme = (theme: CampusTheme) => {
  const preference = getCampusThemePreference()
  applyCampusThemeToCurrentPage(theme)
  applyCampusThemeToNativeChrome(theme)
  listeners.forEach((listener) => listener(theme, preference))
}

const handleSystemThemeChange = ({ theme }: { theme: CampusTheme }) => {
  if (!isCampusTheme(theme)) return
  systemTheme = theme
  if (readStoredPreference() === 'system') {
    publishTheme(theme)
    return
  }

  // theme.json 会响应系统变化；有明确用户偏好时立即恢复用户选择。
  applyCampusThemeToCurrentPage(getCampusTheme())
  applyCampusThemeToNativeChrome(getCampusTheme())
}

export const initializeCampusTheme = () => {
  const theme = getCampusTheme()
  applyCampusThemeToNativeChrome(theme)
  if (!themeListenerInstalled && typeof Taro.onThemeChange === 'function') {
    Taro.onThemeChange(handleSystemThemeChange)
    themeListenerInstalled = true
  }
  return theme
}

const persistCampusThemePreference = (preference: CampusThemePreference) => {
  storedPreference = preference
  try {
    Taro.setStorageSync(CAMPUS_THEME_STORAGE_KEY, preference)
  } catch {
    // 存储失败不阻塞本次主题切换，当前会话仍保持用户选择。
  }
}

export const setCampusThemePreference = (preference: CampusThemePreference) => {
  persistCampusThemePreference(preference)
  publishTheme(getCampusTheme())
}

export const restartWithCampusThemePreference = (preference: CampusThemePreference) => {
  persistCampusThemePreference(preference)

  const fallback = () => {
    publishTheme(getCampusTheme())
    void Taro.reLaunch({ url: '/pages/index/index' })
  }

  if (typeof wx !== 'undefined' && typeof wx.restartMiniProgram === 'function') {
    wx.restartMiniProgram({
      path: '/pages/index/index',
      fail: fallback,
    })
    return
  }

  fallback()
}

export const setCampusTheme = (theme: CampusTheme) => setCampusThemePreference(theme)

export const subscribeCampusTheme = (listener: ThemeListener) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
