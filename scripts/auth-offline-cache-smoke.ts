import { strict as assert } from 'node:assert'
import Module = require('node:module')

let cleared = 0
const networkError = new Error('refresh timeout')
const loader = Module as unknown as { _load: (...args: any[]) => any }
const original = loader._load
loader._load = function (name, ...args) {
  if (name === '@tarojs/taro') return { default: { request: async () => ({ statusCode: 401, data: { error: { code: 'session_expired', message: 'expired' } } }) } }
  if (name === './auth') return { apiUrl: (s: string) => s, ensureAccessToken: async () => 'old', refreshAccessToken: async () => { throw networkError }, clearSession: () => { cleared++ } }
  if (name.includes('error-reporting')) return { reportClientError: async () => undefined }
  if (name.includes('academic-verification/guard')) return { handleAcademicVerificationRequired: async () => undefined }
  return original.call(this, name, ...args)
}
const { apiRequest } = require('../src/api/client')
loader._load = original
void (async () => {
  await assert.rejects(apiRequest({ path: '/test' }))
  assert.equal(cleared, 0, '刷新授权超时不能清除本地会话和离线展示身份')
  console.log('auth offline cache smoke: ok')
})()
