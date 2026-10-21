import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import ts = require('typescript')
import { createCustomTabBarVisibilityController } from '../src/utils/tabbar-visibility'

const published: boolean[] = []
const firstTab = { hidden: false }
const secondTab = { hidden: false }
let currentTab = firstTab
const visibility = createCustomTabBarVisibilityController(
  () => currentTab,
  (tabBar, hidden) => {
    tabBar.hidden = hidden
    published.push(hidden)
  },
)

// 详情子页拥有页面级隐藏；Sheet 的关闭不能解除页面的隐藏状态。
visibility.setPageHidden(true)
assert.equal(firstTab.hidden, true)
const detailSheet = visibility.acquire()
assert.equal(firstTab.hidden, true)
detailSheet()
assert.equal(firstTab.hidden, true)

// 子页销毁时若没有发送隐藏回调，Tab 根页重新同步时只清理自己的残留。
currentTab = secondTab
visibility.resetPageHidden()
assert.equal(secondTab.hidden, false)
currentTab = firstTab
visibility.resetPageHidden()
assert.equal(firstTab.hidden, false)

// Tab 页 Sheet 关闭后恢复显示，两个同时打开的 Sheet 需要全部关闭后才显示。
const firstSheet = visibility.acquire()
const secondSheet = visibility.acquire()
assert.equal(firstTab.hidden, true)
firstSheet()
assert.equal(firstTab.hidden, true)
secondSheet()
assert.equal(firstTab.hidden, false)
secondSheet()
assert.equal(firstTab.hidden, false)

// 旧 Tab 上仍挂载的 Sheet 只控制旧 Tab 实例，不影响新 Tab。
const oldTabSheet = visibility.acquire()
assert.equal(firstTab.hidden, true)
currentTab = secondTab
visibility.resetPageHidden()
assert.equal(secondTab.hidden, false)
assert.equal(firstTab.hidden, true)
oldTabSheet()
assert.equal(firstTab.hidden, false)
assert.equal(secondTab.hidden, false)

assert.equal(visibility.isHidden(firstTab), false)
assert.equal(visibility.isHidden(secondTab), false)
assert.equal(published.includes(true), true)
assert.equal(published.at(-1), false)

const tabBarSource = readFileSync('src/custom-tab-bar/index.js', 'utf8')
const tabBarAst = ts.createSourceFile('custom-tab-bar.js', tabBarSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
const findTopLevelVariable = (name: string) => {
  const declaration = tabBarAst.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => [...statement.declarationList.declarations])
    .find((item) => ts.isIdentifier(item.name) && item.name.text === name)
  assert.ok(declaration?.initializer, `真实 TabBar 源码应包含 ${name}`)
  return declaration!.initializer!
}
const componentCall = tabBarAst.statements
  .filter(ts.isExpressionStatement)
  .map((statement) => statement.expression)
  .find((expression) => ts.isCallExpression(expression)
    && ts.isIdentifier(expression.expression)
    && expression.expression.text === 'Component')
assert.ok(componentCall && ts.isCallExpression(componentCall), '应找到真实 custom-tab-bar Component')
const componentOptions = componentCall.arguments[0]
assert.ok(componentOptions && ts.isObjectLiteralExpression(componentOptions), 'Component 应使用对象配置')
const methodsProperty = componentOptions.properties.find((property) => (
  ts.isPropertyAssignment(property)
  && ts.isIdentifier(property.name)
  && property.name.text === 'methods'
))
assert.ok(methodsProperty && ts.isPropertyAssignment(methodsProperty), '应找到真实 TabBar methods')
const methodsObject = methodsProperty.initializer
assert.ok(ts.isObjectLiteralExpression(methodsObject), 'TabBar methods 应是对象')
const extractMethod = (name: string) => {
  const method = methodsObject.properties.find((property) => (
    ts.isMethodDeclaration(property)
    && ts.isIdentifier(property.name)
    && property.name.text === name
  ))
  assert.ok(method, `真实 TabBar methods 应包含 ${name}`)
  return method!.getText(tabBarAst)
}
const switchedUrls: string[] = []
const makeTabBarMethods = new Function(
  'qualification',
  'getCurrentPages',
  'getStoredUnreadCount',
  'wx',
  'requestWechatSubscriptionForModule',
  `const fullTabs = ${findTopLevelVariable('fullTabs').getText(tabBarAst)}
const buildTabList = ${findTopLevelVariable('buildTabList').getText(tabBarAst)}
return {
  buildTabList,
  ${extractMethod('applyAffiliateCapabilities')},
  ${extractMethod('syncSelected')},
  ${extractMethod('switchTab')}
}`,
) as (
  qualification: boolean,
  getCurrentPages: () => Array<{ route: string }>,
  getStoredUnreadCount: () => number,
  wx: { pageScrollTo: () => void; switchTab: (options: { url: string }) => void },
  requestWechatSubscriptionForModule: (module: string) => void,
) => {
  buildTabList: (enabled: boolean) => Array<{ pagePath: string }>
  applyAffiliateCapabilities: (snapshot: { capabilities: { enabled: boolean } }) => void
  syncSelected: () => void
  switchTab: (event: { currentTarget: { dataset: { index: number } } }) => void
}

const createTabBarHandlerHarness = (
  route: string,
  enabled: boolean,
  qualificationEdition = false,
) => {
  let currentRoute = route
  const methods = makeTabBarMethods(
    qualificationEdition,
    () => [{ route: currentRoute }],
    () => 0,
    {
      pageScrollTo: () => undefined,
      switchTab: ({ url }) => switchedUrls.push(url),
    },
    () => undefined,
  )
  const data = {
    selected: 0,
    hidden: false,
    unreadCount: 0,
    list: methods.buildTabList(enabled),
  }
  const tabBar = {
    data,
    setData(next: Partial<typeof data>) {
      Object.assign(data, next)
    },
    syncSelected() {
      methods.syncSelected.call(tabBar)
    },
    applyAffiliateCapabilities(snapshot: { capabilities: { enabled: boolean } }) {
      methods.applyAffiliateCapabilities.call(tabBar, snapshot)
    },
    switchTab(index: number) {
      methods.switchTab.call(tabBar, { currentTarget: { dataset: { index } } })
    },
  }
  tabBar.syncSelected()
  return {
    tabBar,
    setRoute(nextRoute: string) { currentRoute = nextRoute },
    setAffiliateEnabled(nextEnabled: boolean) {
      tabBar.applyAffiliateCapabilities({ capabilities: { enabled: nextEnabled } })
    },
  }
}

const dynamicGoodsTab = createTabBarHandlerHarness('pages/goods/index', true)
assert.equal(dynamicGoodsTab.tabBar.data.list[2]?.pagePath, 'pages/goods/index', '启用时好物应处于普通版第三个 Tab')
assert.equal(dynamicGoodsTab.tabBar.data.selected, 2)
dynamicGoodsTab.setAffiliateEnabled(false)
assert.equal(dynamicGoodsTab.tabBar.data.list.some((item) => item.pagePath === 'pages/goods/index'), false)
assert.equal(dynamicGoodsTab.tabBar.data.selected, -1, '关闭能力时仍停留在好物页应无高亮')
dynamicGoodsTab.setAffiliateEnabled(true)
assert.equal(dynamicGoodsTab.tabBar.data.selected, 2, '重新开启能力时好物页应恢复第三 Tab 选中态')

const hiddenGoodsPage = createTabBarHandlerHarness('pages/goods/search', true)
assert.equal(hiddenGoodsPage.tabBar.data.selected, -1, '搜索子页不属于底部 Tab，应显示无高亮')
hiddenGoodsPage.tabBar.data.hidden = true
hiddenGoodsPage.setAffiliateEnabled(false)
assert.equal(hiddenGoodsPage.tabBar.data.selected, -1)
assert.equal(hiddenGoodsPage.tabBar.data.hidden, true, '隐藏子页切换能力时不应擅自显示底栏')
hiddenGoodsPage.setRoute('pages/messages/index')
hiddenGoodsPage.tabBar.data.hidden = false
hiddenGoodsPage.tabBar.syncSelected()
assert.equal(hiddenGoodsPage.tabBar.data.selected, 2, '从无高亮子页返回消息 Tab 时应按新列表重映射')
hiddenGoodsPage.tabBar.switchTab(3)
assert.equal(switchedUrls.at(-1), '/pages/profile/index', '无高亮时点击其他 Tab 应正常导航')
assert.equal(hiddenGoodsPage.tabBar.data.selected, 3)

const enabledMessagesTab = createTabBarHandlerHarness('pages/messages/index', true)
assert.equal(enabledMessagesTab.tabBar.data.selected, 3)
enabledMessagesTab.setAffiliateEnabled(false)
assert.equal(enabledMessagesTab.tabBar.data.selected, 2, '关闭好物后消息 Tab 应按压缩后的列表选中')
enabledMessagesTab.setAffiliateEnabled(true)
assert.equal(enabledMessagesTab.tabBar.data.selected, 3, '重新开启好物后消息 Tab 应恢复映射')

const qualificationMessagesTab = createTabBarHandlerHarness('pages/messages/index', true, true)
assert.equal(qualificationMessagesTab.tabBar.data.selected, 2, '资格版默认不含社区且好物位于第三项')
qualificationMessagesTab.setAffiliateEnabled(false)
assert.equal(qualificationMessagesTab.tabBar.data.selected, 1, '资格版关闭好物后消息 Tab 应映射到第二项')

console.log('Affiliate TabBar visibility regression checks passed')
