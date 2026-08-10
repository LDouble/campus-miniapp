const { apiUrl } = require('./config.js')
const { ensureAccessToken, refreshAccessToken } = require('./auth.js')

const refreshableErrorCodes = new Set([
  'missing_token',
  'invalid_access_token',
  'session_expired',
])

const toQueryString = (query) => {
  const entries = Object.entries(query || {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  return entries.length ? `?${entries.join('&')}` : ''
}

const requestRaw = (options) => new Promise((resolve, reject) => {
  wx.request({
    ...options,
    success: resolve,
    fail: reject,
  })
})

const errorFromResponse = (response) => {
  const body = response && response.data && typeof response.data === 'object' ? response.data : {}
  const error = body.error && typeof body.error === 'object' ? body.error : {}
  const message = error.message || '校园服务暂时不可用'
  const result = new Error(message)
  result.statusCode = response.statusCode || 0
  result.code = error.code || 'request_failed'
  result.requestId = body.request_id || ''
  return result
}

const send = async (path, query, token) => {
  const response = await requestRaw({
    url: `${apiUrl(path)}${toQueryString(query)}`,
    method: 'GET',
    header: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })
  if (response.statusCode < 200 || response.statusCode >= 300) throw errorFromResponse(response)
  if (!response.data || typeof response.data !== 'object' || !('data' in response.data)) {
    throw new Error('校园服务返回了无效数据')
  }
  return response.data.data
}

// 每个业务请求最多因 401 刷新一次并重试一次，避免无限认证循环。
const get = async (path, query) => {
  const token = await ensureAccessToken()
  try {
    return await send(path, query, token)
  } catch (error) {
    if (error.statusCode !== 401 || !refreshableErrorCodes.has(error.code)) throw error
    const refreshedToken = await refreshAccessToken(token)
    return send(path, query, refreshedToken)
  }
}

module.exports = { get }
