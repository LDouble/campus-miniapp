import Taro from '@tarojs/taro'
import { createAppUpdateInstaller } from './controller'

export const installAppUpdate = createAppUpdateInstaller({
  platform: process.env.TARO_ENV,
  getUpdateManager: () => Taro.getUpdateManager(),
  notifyUpdateFailed: () => {
    void Taro.showModal({
      title: '更新失败',
      content: '新版本下载失败，请检查网络后重新打开小程序',
      showCancel: false,
      confirmText: '我知道了',
    }).catch(() => undefined)
  },
})
