export type AppUpdateManager = {
  onUpdateReady: (callback: () => void) => void
  onUpdateFailed: (callback: () => void) => void
  applyUpdate: () => void
}

type AppUpdateInstallerOptions = {
  platform: string | undefined
  getUpdateManager: () => AppUpdateManager
  notifyUpdateFailed: () => void
}

export const createAppUpdateInstaller = ({
  platform,
  getUpdateManager,
  notifyUpdateFailed,
}: AppUpdateInstallerOptions) => {
  let installed = false

  return () => {
    if (platform !== 'weapp' || installed) return

    const updateManager = getUpdateManager()
    installed = true
    updateManager.onUpdateReady(() => {
      updateManager.applyUpdate()
    })
    updateManager.onUpdateFailed(() => {
      notifyUpdateFailed()
    })
  }
}
