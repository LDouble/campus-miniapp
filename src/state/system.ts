import Taro from '@tarojs/taro'

export interface AppWindowInfo {
  windowWidth: number
  windowHeight: number
  statusBarHeight: number
}

export interface AppMenuButtonRect {
  width: number
  height: number
  top: number
  left: number
}

export interface AppSystemState {
  windowInfo: AppWindowInfo
  menuButtonRect: AppMenuButtonRect
}

const fallbackSystemState: AppSystemState = {
  windowInfo: {
    windowWidth: 375,
    windowHeight: 667,
    statusBarHeight: 20,
  },
  menuButtonRect: {
    width: 0,
    height: 0,
    top: 0,
    left: 0,
  },
}

let systemState: AppSystemState | null = null

export const initializeSystemState = () => {
  if (systemState) return systemState

  let windowInfo = fallbackSystemState.windowInfo
  let menuButtonRect = fallbackSystemState.menuButtonRect

  try {
    const currentWindowInfo = Taro.getWindowInfo()
    windowInfo = {
      windowWidth: currentWindowInfo.windowWidth || windowInfo.windowWidth,
      windowHeight: currentWindowInfo.windowHeight || windowInfo.windowHeight,
      statusBarHeight: currentWindowInfo.statusBarHeight || windowInfo.statusBarHeight,
    }
  } catch {
    // Keep fallback metrics when the current runtime does not expose this API.
  }

  try {
    const currentMenuButtonRect = Taro.getMenuButtonBoundingClientRect()
    menuButtonRect = {
      width: currentMenuButtonRect.width || 0,
      height: currentMenuButtonRect.height || 0,
      top: currentMenuButtonRect.top || 0,
      left: currentMenuButtonRect.left || 0,
    }
  } catch {
    // Some non-WeChat build targets do not provide a menu button.
  }

  systemState = { windowInfo, menuButtonRect }
  return systemState
}

export const getSystemState = () => systemState || initializeSystemState()
