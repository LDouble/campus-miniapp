const REVIEW_API_BASE_URL = 'https://review.weouc.com'
const PRODUCTION_API_BASE_URL = 'https://product.weouc.com'

const miniProgramInfo = () => {
  try {
    return wx.getAccountInfoSync().miniProgram || {}
  } catch {
    return {}
  }
}

const apiBaseUrl = () => {
  const { envVersion } = miniProgramInfo()
  return envVersion === 'trial' || envVersion === 'release'
    ? PRODUCTION_API_BASE_URL
    : REVIEW_API_BASE_URL
}

const wechatAppId = () => {
  const { appId } = miniProgramInfo()
  if (!appId) throw new Error('无法读取当前小程序 AppID')
  return appId
}

const apiUrl = (path) => `${apiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`

module.exports = {
  apiUrl,
  wechatAppId,
}
