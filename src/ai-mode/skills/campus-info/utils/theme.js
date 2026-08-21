const CAMPUS_THEME_STORAGE_KEY = 'campus-theme-preference'

const getCampusTheme = () => {
  try {
    const storedTheme = wx.getStorageSync(CAMPUS_THEME_STORAGE_KEY)
    if (storedTheme === 'dark' || storedTheme === 'light') return storedTheme
  } catch (_) {
    // AI 独立分包无法读取存储时回退到系统主题。
  }

  try {
    return wx.getAppBaseInfo().theme === 'dark' ? 'dark' : 'light'
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
