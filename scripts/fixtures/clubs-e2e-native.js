() => {
  const stateKey = 'campus.club.e2e.native.v1'
  const source = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
  const fileSystem = wx.getFileSystemManager()
  const root = wx.env.USER_DATA_PATH
  const files = [
    `${root}/club-e2e-logo.png`,
    `${root}/club-e2e-gallery-a.png`,
    `${root}/club-e2e-gallery-b.png`,
    `${root}/club-e2e-gallery-new.png`,
  ]
  files.forEach((path) => fileSystem.writeFileSync(path, source, 'base64'))

  let taro
  wx.__clubE2EChunkSequence = Math.max(
    Date.now(),
    Number(wx.__clubE2EChunkSequence || 0) + 1,
  )
  wx.webpackJsonp.push([[wx.__clubE2EChunkSequence], {}, (moduleRequire) => {
    taro = moduleRequire(2954)
  }])
  if (!taro) throw new Error('无法获取 Taro 运行时单例')

  const debug = {
    installedAt: Date.now(),
    wxChooseCalls: 0,
    taroChooseCalls: 0,
    cropCalls: 0,
    getFileInfoCalls: 0,
    getImageInfoCalls: 0,
    toast: '',
  }
  wx.__clubE2EDebug = debug

  if (!wx.__clubE2ENativeOriginal) {
    wx.__clubE2ENativeOriginal = {
      chooseMedia: wx.chooseMedia,
      cropImage: wx.cropImage,
      showModal: wx.showModal,
      taroChooseMedia: taro.chooseMedia,
      taroCropImage: taro.cropImage,
      taroGetFileInfo: taro.getFileInfo,
      taroGetImageInfo: taro.getImageInfo,
      taroShowModal: taro.showModal,
      taroShowToast: taro.showToast,
    }
  }
  wx.__clubE2ETaro = taro
  const existingIndex = wx.getStorageSync(stateKey)
  if (existingIndex === '' || existingIndex === null || existingIndex === undefined) {
    wx.setStorageSync(stateKey, 0)
  }

  const chooseResult = () => {
    const batches = [
      [files[0]],
      [files[1], files[2]],
      [files[3]],
    ]
    const index = Number(wx.getStorageSync(stateKey) || 0)
    const selected = batches[index] || []
    wx.setStorageSync(stateKey, index + 1)
    const result = {
      tempFiles: selected.map((tempFilePath) => ({
        tempFilePath,
        size: 68,
        width: 1,
        height: 1,
        fileType: 'image',
      })),
      type: 'image',
      errMsg: 'chooseMedia:ok',
    }
    return result
  }

  wx.chooseMedia = (options) => {
    debug.wxChooseCalls += 1
    const result = chooseResult()
    setTimeout(() => {
      if (options.success) options.success(result)
      if (options.complete) options.complete(result)
    }, 10)
  }
  taro.chooseMedia = async () => {
    debug.taroChooseCalls += 1
    return chooseResult()
  }

  wx.cropImage = (options) => {
    debug.cropCalls += 1
    const result = { tempFilePath: options.src, errMsg: 'cropImage:ok' }
    setTimeout(() => {
      if (options.success) options.success(result)
      if (options.complete) options.complete(result)
    }, 10)
  }
  taro.cropImage = async (options) => {
    debug.cropCalls += 1
    return {
      tempFilePath: options.src,
      errMsg: 'cropImage:ok',
    }
  }
  taro.getFileInfo = async () => {
    debug.getFileInfoCalls += 1
    return {
      size: 68,
      errMsg: 'getFileInfo:ok',
    }
  }
  taro.getImageInfo = async (options) => {
    debug.getImageInfoCalls += 1
    return {
      width: 1,
      height: 1,
      path: options.src,
      orientation: 'up',
      type: 'png',
      errMsg: 'getImageInfo:ok',
    }
  }
  taro.showToast = (options) => {
    debug.toast = options.title || ''
    return wx.__clubE2ENativeOriginal.taroShowToast(options)
  }

  wx.showModal = (options) => {
    const result = { confirm: true, cancel: false, content: '', errMsg: 'showModal:ok' }
    setTimeout(() => {
      if (options.success) options.success(result)
      if (options.complete) options.complete(result)
    }, 10)
  }
  taro.showModal = async () => ({
    confirm: true,
    cancel: false,
    content: '',
    errMsg: 'showModal:ok',
  })

  return {
    installed: true,
    files,
    taroPatched: taro.chooseMedia !== wx.__clubE2ENativeOriginal.taroChooseMedia,
  }
}
