// 构建复制阶段会将占位符替换为 TARO_APP_MINIAPP_VERSION；未配置时回退微信运行时版本。
const compiledMiniappVersion = '__CAMPUS_MINIAPP_VERSION__'

const normalizeMiniappVersion = (value) => (
  typeof value === 'string' ? value.trim() : ''
)

const getMiniappVersion = () => {
  const compiled = normalizeMiniappVersion(compiledMiniappVersion)
  if (compiled && compiled !== '__CAMPUS_MINIAPP_VERSION__') return compiled
  try {
    const info = wx.getAccountInfoSync()
    return normalizeMiniappVersion(info && info.miniProgram && info.miniProgram.version)
  } catch {
    return ''
  }
}

const withMiniappVersion = (header) => {
  const version = getMiniappVersion()
  return version ? { ...header, 'X-Miniapp-Version': version } : header
}

module.exports = { getMiniappVersion, withMiniappVersion }
