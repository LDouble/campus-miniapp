const { apiUrl, wechatAppId } = require('./config.js')

// 与主包共享登录态；Skill 仍自行完成 wx.login，避免依赖主包模块运行状态。
const ACCESS_TOKEN_KEY = 'campus.auth.accessToken.v1'
const REFRESH_TOKEN_KEY = 'campus.auth.refreshToken.v1'
const EXPIRES_AT_KEY = 'campus.auth.expiresAt.v1'
const ACCOUNT_CANCELLED_KEY = 'campus.auth.accountCancelled.v1'
const REFRESH_SKEW_MS = 30 * 1000

let loginPromise = null
let refreshPromise = null

const requestRaw = (options) => new Promise((resolve, reject) => {
  wx.request({
    ...options,
    success: resolve,
    fail: reject,
  })
})

const loginCode = () => new Promise((resolve, reject) => {
  wx.login({
    success: (result) => {
      if (result.code) {
        resolve(result.code)
        return
      }
      reject(new Error('微信登录凭证为空'))
    },
    fail: reject,
  })
})

const getTokens = () => ({
  accessToken: String(wx.getStorageSync(ACCESS_TOKEN_KEY) || ''),
  refreshToken: String(wx.getStorageSync(REFRESH_TOKEN_KEY) || ''),
  expiresAt: Number(wx.getStorageSync(EXPIRES_AT_KEY) || 0),
})

const accountIsCancelled = () => wx.getStorageSync(ACCOUNT_CANCELLED_KEY) === true

const assertActiveAccount = () => {
  if (accountIsCancelled()) throw new Error('账号已注销，如需继续使用请在小程序内重新注册')
}

const isUsableToken = (tokens) => (
  !!tokens.accessToken && tokens.expiresAt > Date.now() + REFRESH_SKEW_MS
)

const clearTokens = () => {
  wx.removeStorageSync(ACCESS_TOKEN_KEY)
  wx.removeStorageSync(REFRESH_TOKEN_KEY)
  wx.removeStorageSync(EXPIRES_AT_KEY)
}

const saveTokens = (tokens) => {
  if (!tokens || !tokens.access_token || !tokens.refresh_token || !tokens.expires_in) {
    throw new Error('登录响应缺少令牌')
  }
  wx.setStorageSync(ACCESS_TOKEN_KEY, tokens.access_token)
  wx.setStorageSync(REFRESH_TOKEN_KEY, tokens.refresh_token)
  wx.setStorageSync(EXPIRES_AT_KEY, Date.now() + Number(tokens.expires_in) * 1000)
  return tokens.access_token
}

const responseData = (response) => (
  response && response.data && typeof response.data === 'object' ? response.data : {}
)

const login = () => {
  if (!loginPromise) {
    loginPromise = (async () => {
      assertActiveAccount()
      const code = await loginCode()
      const response = await requestRaw({
        url: apiUrl('/api/v1/auth/wechat/login'),
        method: 'POST',
        data: { app_id: wechatAppId(), code },
        header: { Accept: 'application/json', 'Content-Type': 'application/json' },
      })
      const body = responseData(response)
      if (response.statusCode < 200 || response.statusCode >= 300 || !body.data) {
        throw new Error((body.error && body.error.message) || '校园服务登录失败')
      }
      return saveTokens(body.data)
    })().finally(() => {
      loginPromise = null
    })
  }
  return loginPromise
}

const refreshAccessToken = (failedAccessToken = '') => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      assertActiveAccount()
      const previous = getTokens()
      // 主包和 Skill 可能同时刷新。若已由另一上下文写入新令牌，直接复用。
      if (failedAccessToken && previous.accessToken !== failedAccessToken && isUsableToken(previous)) {
        return previous.accessToken
      }
      const { refreshToken } = previous
      if (!refreshToken) return login()
      try {
        const response = await requestRaw({
          url: apiUrl('/api/v1/auth/refresh'),
          method: 'POST',
          data: { refresh_token: refreshToken },
          header: { Accept: 'application/json', 'Content-Type': 'application/json' },
        })
        const body = responseData(response)
        if (response.statusCode >= 200 && response.statusCode < 300 && body.data) {
          return saveTokens(body.data)
        }
        // 刷新失败（特别是 401）前，先检查主包是否已完成并发刷新。
        const latest = getTokens()
        if (latest.accessToken !== previous.accessToken && isUsableToken(latest)) {
          return latest.accessToken
        }
        if (response.statusCode === 401) {
          clearTokens()
          return login()
        }
        throw new Error((body.error && body.error.message) || '登录状态刷新失败')
      } catch (error) {
        // 网络失败时同样允许复用另一个上下文刚写入的有效令牌。
        const latest = getTokens()
        if (latest.accessToken !== previous.accessToken && isUsableToken(latest)) {
          return latest.accessToken
        }
        throw error
      }
    })().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

const ensureAccessToken = async () => {
  assertActiveAccount()
  const { accessToken, expiresAt } = getTokens()
  if (!accessToken) return login()
  if (expiresAt <= Date.now() + REFRESH_SKEW_MS) return refreshAccessToken(accessToken)
  return accessToken
}

module.exports = {
  clearTokens,
  ensureAccessToken,
  refreshAccessToken,
}
