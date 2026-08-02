import Taro from '@tarojs/taro'
import {
  CookieStorageRepository,
  CookieStorageScope,
  KeyValueStorage,
} from './cookie-storage'

export const taroKeyValueStorage: KeyValueStorage = {
  get: (key) => Taro.getStorageSync(key),
  set: (key, value) => Taro.setStorageSync(key, value),
  remove: (key) => Taro.removeStorageSync(key),
  keys: () => Taro.getStorageInfoSync().keys,
}

export const createTaroCookiePersistence = (scope: CookieStorageScope) => (
  new CookieStorageRepository(taroKeyValueStorage, scope)
)

export const clearExpiredTaroCookieStorage = () => (
  CookieStorageRepository.clearExpired(taroKeyValueStorage)
)

export const clearTaroCookieStorageForUser = (platformUserId: number) => (
  CookieStorageRepository.clearUser(taroKeyValueStorage, platformUserId)
)

export const clearAllTaroCookieStorage = () => (
  CookieStorageRepository.clearAll(taroKeyValueStorage)
)

