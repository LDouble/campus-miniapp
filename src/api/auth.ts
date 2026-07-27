import Taro from '@tarojs/taro'
import type { ApiErrorEnvelope, ApiSuccessEnvelope, TokenPair } from './types'
import { clearAcademicCredential } from './academic-credential'

const ACCESS_TOKEN_KEY = 'campus.auth.accessToken.v1'
const REFRESH_TOKEN_KEY = 'campus.auth.refreshToken.v1'
const TOKEN_EXPIRES_AT_KEY = 'campus.auth.expiresAt.v1'
export const API_BASE_URL = String(__CAMPUS_API_BASE_URL__).replace(/\/+$/, '')

export const WECHAT_APP_ID = String(__CAMPUS_WECHAT_APP_ID__)

let authenticatePromise: Promise<string> | null = null
let refreshPromise: Promise<string> | null = null

const tokenExpiresSoon = () => {
  const expiresAt = Number(Taro.getStorageSync<number>(TOKEN_EXPIRES_AT_KEY) || 0)
  return expiresAt > 0 && expiresAt <= Date.now() + 30_000
}

const saveTokens = (tokens: TokenPair) => {
  Taro.setStorageSync(ACCESS_TOKEN_KEY, tokens.access_token)
  Taro.setStorageSync(REFRESH_TOKEN_KEY, tokens.refresh_token)
  Taro.setStorageSync(TOKEN_EXPIRES_AT_KEY, Date.now() + tokens.expires_in * 1000)
}

export const clearSession = () => {
  clearAcademicCredential()
  Taro.removeStorageSync(ACCESS_TOKEN_KEY)
  Taro.removeStorageSync(REFRESH_TOKEN_KEY)
  Taro.removeStorageSync(TOKEN_EXPIRES_AT_KEY)
}

export const getAccessToken = () => (
  String(Taro.getStorageSync<string>(ACCESS_TOKEN_KEY) || '')
)

const getRefreshToken = () => (
  String(Taro.getStorageSync<string>(REFRESH_TOKEN_KEY) || '')
)

const parseTokenResponse = (
  statusCode: number,
  body: ApiSuccessEnvelope<TokenPair> | ApiErrorEnvelope,
) => {
  if (statusCode >= 200 && statusCode < 300 && 'data' in body) {
    saveTokens(body.data)
    return body.data.access_token
  }
  const errorBody = 'error' in body ? body.error : null
  throw new Error(errorBody?.message || '校园服务登录失败')
}

const wechatLogin = async () => {
  const loginResult = await Taro.login()
  if (!loginResult.code) throw new Error('微信登录凭证获取失败')

  const response = await Taro.request<ApiSuccessEnvelope<TokenPair> | ApiErrorEnvelope>({
    url: `${API_BASE_URL}/api/v1/auth/wechat/login`,
    method: 'POST',
    data: {
      app_id: WECHAT_APP_ID,
      code: loginResult.code,
    },
    header: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  })
  return parseTokenResponse(response.statusCode, response.data)
}

export const login = () => {
  if (!authenticatePromise) {
    authenticatePromise = wechatLogin().finally(() => {
      authenticatePromise = null
    })
  }
  return authenticatePromise
}

export const refreshAccessToken = () => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = getRefreshToken()
      if (!refreshToken) return login()

      const response = await Taro.request<ApiSuccessEnvelope<TokenPair> | ApiErrorEnvelope>({
        url: `${API_BASE_URL}/api/v1/auth/refresh`,
        method: 'POST',
        data: { refresh_token: refreshToken },
        header: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      })
      if (response.statusCode === 401) {
        clearSession()
        return login()
      }
      return parseTokenResponse(response.statusCode, response.data)
    })().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

export const ensureAccessToken = async () => {
  const current = getAccessToken()
  if (!current) return login()
  if (tokenExpiresSoon()) return refreshAccessToken()
  return current
}
