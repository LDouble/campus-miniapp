import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import * as ts from 'typescript'

const pagePath = resolve(__dirname, '../src/pages/academic-verification/index.tsx')
const pageSource = readFileSync(pagePath, 'utf8')
const sourceFile = ts.createSourceFile(
  pagePath,
  pageSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
)

const evaluatePageHelper = (name: string) => {
  const declaration = sourceFile.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => statement.declarationList.declarations)
    .find((item) => ts.isIdentifier(item.name) && item.name.text === name)
  assert.ok(declaration?.initializer, `${name} 应在身份页中定义`)
  const helperSource = ts.transpile(`(${declaration.initializer.getText(sourceFile)})`, {
    target: ts.ScriptTarget.ES2019,
  })
  return runInNewContext(helperSource) as (...args: never[]) => unknown
}

const resolveActionLabel = evaluatePageHelper('resolveAcademicCredentialActionLabel')
assert.equal(resolveActionLabel(false), '去绑定')
assert.equal(resolveActionLabel(true), '去更新密码')
assert.equal(resolveActionLabel(null), '正在读取本机密码')

const isCurrentRead = evaluatePageHelper('isCurrentAcademicCredentialRead') as (input: {
  requestId: number
  currentRequestId: number
  requestSessionGeneration: number
  currentSessionGeneration: number
  cachedUserId: number
  resolvedUserId: number
}) => boolean
const readContext = {
  requestId: 2,
  currentRequestId: 2,
  requestSessionGeneration: 7,
  currentSessionGeneration: 7,
  cachedUserId: 11,
  resolvedUserId: 11,
}
assert.equal(isCurrentRead(readContext), true, '当前账号的最新读取可以更新页面')
assert.equal(isCurrentRead({
  ...readContext,
  requestSessionGeneration: 7,
  currentSessionGeneration: 8,
  cachedUserId: 12,
  resolvedUserId: 12,
}), true, '切换账号后，当前账号结果仍可用于更新页面')
assert.equal(isCurrentRead({
  ...readContext,
  currentSessionGeneration: 8,
  cachedUserId: 12,
}), false, '旧账号结果不能覆盖切换后的账号状态')
assert.equal(isCurrentRead({
  ...readContext,
  requestId: 1,
}), false, '较早一次页面展示的结果不能覆盖较新的读取')
assert.equal(isCurrentRead({
  ...readContext,
  currentSessionGeneration: 8,
  cachedUserId: 0,
}), false, '会话已清除时不能应用尚未确认账号的结果')

let pageShow: ts.CallExpression | null = null
const findPageShow = (node: ts.Node) => {
  if (ts.isCallExpression(node)
    && ts.isIdentifier(node.expression)
    && node.expression.text === 'useDidShow') {
    pageShow = node
    return
  }
  ts.forEachChild(node, findPageShow)
}
findPageShow(sourceFile)
assert.ok(pageShow && ts.isCallExpression(pageShow), '页面应在 useDidShow 时读取本地密码状态')
const showCallback = pageShow.arguments[0]
assert.ok(ts.isArrowFunction(showCallback), 'useDidShow 应使用可检查的回调')
const showSource = showCallback.getText(sourceFile)
assert.ok(showSource.includes('getCurrentIdentity()'), '每次展示都应获取当前平台用户')
assert.ok(showSource.includes('updateLocalCredentialState(currentUser.user_id)'), '凭据状态应按当前平台用户更新')
assert.ok(showSource.includes('isCurrentAcademicCredentialRead('), '异步结果应通过账号与展示序号校验')
assert.ok(pageSource.includes('loadAcademicCredential(userId)'), '凭据应按平台用户 ID 从本地重新读取')
assert.ok(pageSource.includes('setStudentNo(credential?.studentNo || \'\')'), '切换平台账号后应替换旧学号')
assert.ok(pageSource.includes("setPassword('')"), '切换平台账号后应清除旧密码输入')

const actionStart = pageSource.indexOf("className='verification-credential-action'")
const actionEnd = pageSource.indexOf('</View>', actionStart)
const actionSource = pageSource.slice(actionStart, actionEnd)
assert.ok(actionSource.includes('resolveAcademicCredentialActionLabel(hasLocalAcademicPassword)'), '按钮文案应按本地密码状态决定')
assert.ok(actionSource.includes('setForceCredentialBinding(true)'), '按钮应进入信息门户密码填写流程')

process.stdout.write('academic verification credential action smoke: ok\n')
