import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path: string) => readFileSync(resolve(__dirname, path), 'utf8')
const guard = read('../src/utils/navigation.ts')

assert.match(guard, /pendingTargets\.has\(target\)/u, '重复点击应被导航锁拦截')
assert.match(guard, /Promise\.race/u, '导航应有业务层超时保护')
assert.match(guard, /navigation_timeout/u, '导航超时应有可识别的错误阶段')
assert.match(guard, /reportClientError/u, '导航失败应进入客户端错误上报')
assert.match(guard, /currentRoute/u, '导航日志应包含当前路由')
assert.match(guard, /stackDepth/u, '导航日志应包含页面栈深度')
assert.match(guard, /页面打开失败，请稍后重试/u, '导航失败应给用户明确反馈')
assert.match(guard, /getEnterOptionsSync/u, '前台恢复日志应记录微信入口参数')

const app = read('../src/app.ts')
assert.match(app, /logForegroundNavigationState\(\)/u, 'App onShow 应记录恢复时的导航状态')

const appConfig = read('../src/app.config.ts')
assert.match(
  appConfig,
  /const socialMainPages = \[[\s\S]*'pages\/direct-messages\/index'/u,
  '高频 social 页面应登记为主包页面',
)
assert.match(
  appConfig,
  /: \[\.\.\.mainPages, \.\.\.socialMainPages\]/u,
  '完整版主包应包含全部 social 页面',
)
assert.doesNotMatch(
  appConfig,
  /root: 'pages\/(?:community|direct-messages|errands|marketplace|carpool|publish|my-services|content-report)'/u,
  'social 页面不应继续注册为分包',
)

const errorReporting = read('../src/features/error-reporting/index.ts')
assert.match(errorReporting, /Taro\.onPageNotFound/u, '无效分享或通知路径应有页面不存在兜底')
assert.match(errorReporting, /页面已失效，已返回首页/u, '页面不存在时应给用户恢复反馈')

for (const sourcePath of [
  '../src/features/life-services/components/errand-card.tsx',
  '../src/features/life-services/components/marketplace-card.tsx',
  '../src/features/life-services/components/carpool-card.tsx',
  '../src/features/community/feed-panel.tsx',
]) {
  const source = read(sourcePath)
  assert.match(source, /navigateToWithGuard/u, `${sourcePath} 应使用受保护导航`)
}

const runtimeConfig = read('../src/features/runtime-config/index.ts')
assert.match(
  runtimeConfig,
  /else if \(!await navigateToWithGuard\(url\)\) return false/u,
  '模块入口应把导航失败返回给调用方',
)

process.stdout.write('navigation guard smoke: ok\n')
