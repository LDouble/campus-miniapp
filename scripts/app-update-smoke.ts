import { strict as assert } from 'node:assert'
import {
  createAppUpdateInstaller,
  type AppUpdateManager,
} from '../src/features/app-update/controller'

const callbacks: {
  ready?: () => void
  failed?: () => void
} = {}
let managerReads = 0
let applyCount = 0
let failureCount = 0

const manager: AppUpdateManager = {
  onUpdateReady: (callback) => {
    callbacks.ready = callback
  },
  onUpdateFailed: (callback) => {
    callbacks.failed = callback
  },
  applyUpdate: () => {
    applyCount += 1
  },
}

const install = createAppUpdateInstaller({
  platform: 'weapp',
  getUpdateManager: () => {
    managerReads += 1
    return manager
  },
  notifyUpdateFailed: () => {
    failureCount += 1
  },
})

install()
install()
assert.equal(managerReads, 1, '同一运行周期只能注册一次更新管理器')

callbacks.ready?.()
assert.equal(applyCount, 1, '新版本下载完成后应立即强制应用更新')

callbacks.failed?.()
assert.equal(failureCount, 1, '新版本下载失败后应提示用户')

let nonWechatReads = 0
createAppUpdateInstaller({
  platform: 'h5',
  getUpdateManager: () => {
    nonWechatReads += 1
    return manager
  },
  notifyUpdateFailed: () => undefined,
})()
assert.equal(nonWechatReads, 0, '非微信小程序环境不应访问 UpdateManager')

console.log('app update smoke passed')
