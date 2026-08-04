import { parseWechatSubscribeTemplateIds } from '../src/features/wechat-subscription/template-ids'
import { resolvePageSubscriptionModule } from '../src/features/wechat-subscription/module'

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
assertModule('pages/messages/index', null)

console.log('wechat subscription configuration smoke test passed')
