const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')

const read = path => fs.readFileSync(path, 'utf8')
const getVariableInitializer = (source, filename, name) => {
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  for (const statement of ast.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name && declaration.initializer) {
        return declaration.initializer.getText(ast)
      }
    }
  }
  assert.fail(`${filename} 应声明 ${name}`)
}

const appConfig = read('src/app.config.ts')
const customTabBar = read('src/custom-tab-bar/index.js')
const tabBarHelpers = read('src/utils/tabbar.ts')
const expectedFullTabs = [
  'pages/index/index',
  'pages/community/index',
  'pages/messages/index',
  'pages/profile/index',
]
const expectedQualificationTabs = [
  'pages/index/index',
  'pages/messages/index',
  'pages/profile/index',
]

assert.equal(fs.existsSync('src/pages/goods'), false, '优惠中心页面目录应完整移除')
assert.doesNotMatch(appConfig, /pages\/goods\//u, '应用页面注册不得引用优惠中心页面')
assert.doesNotMatch(customTabBar, /pages\/goods\/|优惠中心|text:\s*'好物'/u, '自定义底栏不得保留优惠中心入口')
assert.doesNotMatch(tabBarHelpers, /goods|优惠中心|好物/u, '共享 Tab 索引不得保留优惠中心映射')

const evaluateArray = (source, filename, name) => (
  new Function(`return ${getVariableInitializer(source, filename, name)}`)()
)
const appTabs = evaluateArray(appConfig, 'src/app.config.ts', 'fullTabBarList')
const customTabs = evaluateArray(customTabBar, 'src/custom-tab-bar/index.js', 'fullTabs')
assert.deepEqual(appTabs.map(({ pagePath }) => pagePath), expectedFullTabs, '应用声明的主版本 Tab 顺序应正确')
assert.deepEqual(customTabs.map(({ pagePath }) => pagePath), expectedFullTabs, '自定义 Tab 顺序应与应用声明一致')
assert.deepEqual(
  appTabs.filter(({ pagePath }) => pagePath !== 'pages/community/index').map(({ pagePath }) => pagePath),
  expectedQualificationTabs,
  '资格版移除社区后保留首页、消息、我的顺序',
)

const helperAst = ts.createSourceFile('src/utils/tabbar.ts', tabBarHelpers, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
let pageListExpression
const findTabIndexPages = node => {
  if (ts.isVariableDeclaration(node)
    && ts.isIdentifier(node.name)
    && node.name.text === 'tabBarIndex'
    && node.initializer
    && ts.isArrowFunction(node.initializer)) {
    const visit = child => {
      if (ts.isVariableDeclaration(child)
        && ts.isIdentifier(child.name)
        && child.name.text === 'pages'
        && child.initializer) {
        pageListExpression = child.initializer.getText(helperAst)
        return
      }
      child.forEachChild(visit)
    }
    node.initializer.body.forEachChild(visit)
    return
  }
  node.forEachChild(findTabIndexPages)
}
findTabIndexPages(helperAst)
assert.ok(pageListExpression, 'utils/tabbar.ts 应提供主版本和资格版 Tab 顺序')
const resolveTabIndex = new Function(
  'isQualificationEdition',
  'page',
  `const pages = ${pageListExpression}; return pages.indexOf(page)`,
)
assert.equal(resolveTabIndex(false, 'messages'), 2, '主版本消息 Tab 应位于第三项')
assert.equal(resolveTabIndex(false, 'profile'), 3, '主版本我的 Tab 应位于第四项')
assert.equal(resolveTabIndex(true, 'messages'), 1, '资格版消息 Tab 应位于第二项')
assert.equal(resolveTabIndex(true, 'profile'), 2, '资格版我的 Tab 应位于第三项')

for (const entry of fs.readdirSync('src/assets/tabbar')) {
  assert.doesNotMatch(entry, /^goods(?:-|\.)/u, `底栏图标 ${entry} 不应残留`)
}

console.log('affiliate page and tab removal checks passed')
