import { parseWechatSubscribeTemplateIds } from '../src/features/wechat-subscription/template-ids'
import { resolvePageSubscriptionModule } from '../src/features/wechat-subscription/module'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const assertEqual = (actual: string[], expected: string[], label: string) => {
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw new Error(`${label}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`)
  }
}

assertEqual(
  parseWechatSubscribeTemplateIds(' template-a,template-b,template-a, ,template-c,template-d '),
  ['template-a', 'template-b', 'template-c'],
  '模板 ID 应去重、去空白并限制数量',
)
assertEqual(parseWechatSubscribeTemplateIds(''), [], '空配置应禁用订阅请求')

const assertModule = (
  route: string,
  expected: string | null,
  options?: Record<string, string>,
) => {
  const actual = resolvePageSubscriptionModule({ route, options })
  if (actual !== expected) {
    throw new Error(`模块解析失败: got ${String(actual)}, want ${String(expected)}`)
  }
}

assertModule('pages/academic/grades/index', 'academic_grades')
assertModule('pages/community/index', 'community')
assertModule('pages/community/index', 'errand', { section: 'errands' })
assertModule('pages/community/index', 'marketplace', { section: 'market' })
assertModule('pages/community/index', 'carpool', { section: 'carpool' })
assertModule('pages/errands/detail', 'errand')
assertModule('pages/marketplace/detail', 'marketplace')
assertModule('pages/carpool/detail', 'carpool')
assertModule('pages/publish/index', 'marketplace', { section: 'market' })
assertModule('pages/direct-messages/index', 'private_message')
assertModule('pages/direct-messages/chat', 'private_message', { id: '123' })
assertModule('pages/direct-messages/chat', 'private_message')
assertModule('pages/messages/index', null)

assertModule('packages/social/community/detail', 'community')
assertModule('packages/social/errands/detail', 'errand')
assertModule('packages/social/marketplace/detail', 'marketplace')
assertModule('packages/social/carpool/detail', 'carpool')
assertModule('packages/social/publish/index', 'marketplace', { section: 'market' })
assertModule('packages/social/direct-messages/chat', 'private_message', { id: '123' })

const subscriptionSource = readFileSync(
  resolve(__dirname, '../src/features/wechat-subscription/index.ts'),
  'utf8',
)
if (!subscriptionSource.includes('requestWechatSubscriptionForModuleWithResult')) {
  throw new Error('缺少可返回用户授权结果的模块订阅入口')
}
if (!subscriptionSource.includes('config.subscription_templates[moduleKey]')) {
  throw new Error('模块订阅结果入口必须复用运行时模板配置')
}

const requestSource = readFileSync(
  resolve(__dirname, '../src/features/wechat-subscription/request.ts'),
  'utf8',
)
if (!requestSource.includes('registered: boolean')) {
  throw new Error('订阅结果必须区分微信授权和后端登记结果')
}
if (!requestSource.includes('retryRegistration')) {
  throw new Error('订阅登记失败必须保留本地重试能力')
}
if (!requestSource.includes('idempotencyKey')) {
  throw new Error('订阅登记重试必须复用幂等键')
}

console.log('wechat subscription configuration smoke test passed')
