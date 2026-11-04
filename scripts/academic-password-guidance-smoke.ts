import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
class ApiError extends Error {
  constructor(public statusCode: number, public code: string, message: string) { super(message) }
}
const clientPath = require.resolve('../src/api/client')
require.cache[clientPath] = { id: clientPath, filename: clientPath, loaded: true, exports: { isApiError: (error: unknown) => error instanceof ApiError } } as NodeModule
import { isAcademicCredentialActionRequiredError } from '../src/features/academic-verification/binding-guidance'

for (const code of ['invalid_academic_credentials', 'academic_password_expired', 'academic_account_restricted']) {
  assert.equal(isAcademicCredentialActionRequiredError(new ApiError(401, code, '凭据失效')), true)
}
for (const code of ['academic_retryable', 'academic_provider_busy']) {
  assert.equal(isAcademicCredentialActionRequiredError(new ApiError(503, code, '暂时失败')), false)
}
assert.equal(isAcademicCredentialActionRequiredError(new Error('网络失败')), false)
for (const page of ['grades', 'exams', 'selection', 'course-addition-results', 'schedule']) {
  const source = readFileSync(resolve(__dirname, `../src/pages/academic/${page}/index.tsx`), 'utf8')
  assert.ok(source.includes('isAcademicCredentialActionRequiredError(loadError)'), `${page} 缓存状态也应提供密码更新入口`)
}
const schedule = readFileSync(resolve(__dirname, '../src/pages/academic/schedule/index.tsx'), 'utf8')
const simulationSync = schedule.slice(schedule.indexOf('const syncCourseSelectionSchedule ='), schedule.indexOf('const refreshSchedule ='))
assert.ok(simulationSync.includes('isAcademicCredentialActionRequiredError(error)') && simulationSync.includes('setLoadError(error)'), '模拟课表同步也应展示凭据处理入口')
const source = readFileSync(resolve(__dirname, '../src/pages/academic/components/academic-load-state.tsx'), 'utf8')
assert.ok(source.includes("actionLabel: '去更新密码'"))

const Module = require('module')
const originalLoad = Module._load
Module._load = function (request: string, ...args: unknown[]) {
  if (request === '@tarojs/components') return { Text: 'Text', View: 'View' }
  return originalLoad.call(this, request, ...args)
}
require.extensions['.scss'] = () => undefined
const { resolveAcademicLoadError, AcademicLoadState } = require('../src/pages/academic/components/academic-load-state')
const taro = require('@tarojs/taro').default
let openedUrl = ''
taro.navigateTo = ({ url }: { url: string }) => { openedUrl = url; return Promise.resolve() }
for (const code of ['invalid_academic_credentials', 'academic_password_expired']) {
  const error = new ApiError(401, code, '凭据失效')
  assert.equal(resolveAcademicLoadError(error).actionLabel, '去更新密码')
  const element = AcademicLoadState({ error, onRetry: () => assert.fail('密码错误不应直接重试') })
  element.props.onAction()
  assert.equal(openedUrl, '/pages/academic-verification/index?rebind=1')
}
assert.equal(resolveAcademicLoadError(new ApiError(403, 'academic_account_restricted', '账号受限')).actionLabel, '解锁后重新绑定')
let retryCount = 0
const networkState = AcademicLoadState({ error: new Error('网络中断'), onRetry: () => { retryCount += 1 } })
assert.equal(networkState.props.actionLabel, '重新加载')
networkState.props.onAction()
assert.equal(retryCount, 1)


const profile = readFileSync(resolve(__dirname, '../src/pages/profile/index.tsx'), 'utf8')
assert.ok(profile.includes("hasLocalAcademicPassword ? '去更新密码' : '去绑定'"), '我的校园身份应依据本地密码展示操作')
const identityNameOffset = profile.indexOf('<Text>{identityMenu.name}</Text>')
const identityEntryStart = profile.lastIndexOf("className='profile-identity-entry'", identityNameOffset)
const identityEntry = profile.slice(identityEntryStart, profile.indexOf("className='profile-identity-entry__arrow'", identityNameOffset))
assert.ok(identityEntry.includes('<Text>{identityCredentialAction}</Text>'), '校园身份行必须直接展示绑定或更新密码')
assert.ok(identityEntry.includes('openAcademicCredentialBinding()'), '校园身份行应直达密码填写表单')
assert.ok(profile.includes('setHasLocalAcademicPassword(hasAcademicCredential(getCachedPageUserId()))'), '返回我的页面时应重新读取本地密码状态')

process.stdout.write('academic password guidance smoke: ok\n')
