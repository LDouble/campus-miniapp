// 测试辅助：用 Module._load 拦截 @tarojs/taro，提供内存 storage，避免在
// Node 环境加载真实 Taro runtime（依赖微信小程序全局常量）。
const Module = require('module')

const storage = new Map()
const taroMock = {
  getStorageSync: (key) => storage.get(key),
  setStorageSync: (key, value) => { storage.set(key, value) },
  removeStorageSync: (key) => { storage.delete(key) },
  showToast: () => {},
  showModal: () => Promise.resolve({ confirm: false, cancel: true }),
  navigateTo: () => Promise.resolve(),
  redirectTo: () => Promise.resolve(),
  reLaunch: () => Promise.resolve(),
  switchTab: () => Promise.resolve(),
  navigateBack: () => Promise.resolve(),
  getCurrentPages: () => [],
}

global.__mockTaroStorage = storage

const originalLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (request === '@tarojs/taro') {
    return { default: taroMock, ...taroMock }
  }
  return originalLoad.call(this, request, parent, isMain)
}
