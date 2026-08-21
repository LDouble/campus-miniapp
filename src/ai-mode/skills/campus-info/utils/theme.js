const CAMPUS_THEME_STORAGE_KEY = 'campus-theme-preference'

const getCampusTheme = () => {
  try {
    const storedTheme = wx.getStorageSync(CAMPUS_THEME_STORAGE_KEY)
    if (storedTheme === 'dark' || storedTheme === 'light') return storedTheme
  } catch (_) {
    // AI 独立分包无法读取存储时回退到系统主题。
  }

  try {
    const appBaseInfo = typeof wx.getAppBaseInfo === 'function'
      ? wx.getAppBaseInfo()
      : null
    if (appBaseInfo && (appBaseInfo.theme === 'dark' || appBaseInfo.theme === 'light')) {
      return appBaseInfo.theme
    }
  } catch (_) {
    // 基础库首帧暂时没有 AppBaseInfo 时继续尝试兼容 API。
  }

  try {
    const systemInfo = typeof wx.getSystemInfoSync === 'function'
      ? wx.getSystemInfoSync()
      : null
    return systemInfo && systemInfo.theme === 'dark' ? 'dark' : 'light'
  } catch (_) {
    return 'light'
  }
}

const subscribeCampusTheme = (listener) => {
  if (typeof wx.onThemeChange !== 'function') return () => {}
  const handleThemeChange = () => listener(getCampusTheme())
  wx.onThemeChange(handleThemeChange)
  return () => {
    if (typeof wx.offThemeChange === 'function') wx.offThemeChange(handleThemeChange)
  }
}

module.exports = { getCampusTheme, subscribeCampusTheme }
