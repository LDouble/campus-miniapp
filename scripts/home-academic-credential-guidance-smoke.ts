import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import vm = require('node:vm')
import ts = require('typescript')
import { resolve } from 'node:path'

const pagePath = resolve(__dirname, '../src/pages/index/index.tsx')
const pageSource = readFileSync(pagePath, 'utf8')
const sourceFile = ts.createSourceFile(pagePath, pageSource, ts.ScriptTarget.Latest, true)

const settleStatement = sourceFile.statements.find((statement) => (
  ts.isTypeAliasDeclaration(statement) ? false
    : ts.isVariableStatement(statement)
      && statement.declarationList.declarations.some((declaration) => (
        ts.isIdentifier(declaration.name) && declaration.name.text === 'settle'
      ))
))
const loadLatestAcademicStatement = sourceFile.statements.find((statement) => (
  ts.isVariableStatement(statement)
  && statement.declarationList.declarations.some((declaration) => (
    ts.isIdentifier(declaration.name) && declaration.name.text === 'loadLatestAcademic'
  ))
))
assert.ok(settleStatement, '应保留 settle 请求失败的原始错误')
assert.ok(loadLatestAcademicStatement, '应找到首页教务预览加载流程')

assert.match(pageSource, /isAcademicCredentialActionRequiredError\(coursesResult\.error\)/u)
assert.match(pageSource, /if \(isCurrent\(\)\) setHomeAcademicCredentialError\(error\)/u)
assert.match(pageSource, /if \(isCurrent\(\)\) setHomeAcademicCredentialError\(null\)/u)
assert.match(pageSource, /<AcademicLoadState[\s\S]*?error=\{homeAcademicCredentialError\}/u)
assert.match(pageSource, /onCredentialActionRequired: \(error: unknown\) => void/u)

const extractedSource = [
  settleStatement.getText(sourceFile),
  loadLatestAcademicStatement.getText(sourceFile),
  'globalThis.__homeAcademicTest = { settle, loadLatestAcademic }',
].join('\n')
const compiled = ts.transpileModule(extractedSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
  fileName: pagePath,
}).outputText

let cachedSchedule: any = {
  version: 1,
  platformUserId: 42,
  periods: [],
  coursesByPeriod: { 'period-1': [{ id: 'cached-course' }] },
  coursesUpdatedAtByPeriod: { 'period-1': 1 },
  scheduleNotesByPeriod: {},
}
let courseResponse: Promise<any> = Promise.resolve({ records: [{ id: 'fresh-course' }] })
const context: Record<string, any> = {
  academicRepository: {
    getPeriods: async () => [{ id: 'period-1' }],
    getCourses: () => courseResponse,
  },
  academicStorage: {
    getScheduleCache: () => cachedSchedule,
    setScheduleCache: () => undefined,
  },
  hasAcademicCredential: () => true,
  isAcademicCredentialActionRequiredError: (error: any) => [
    'invalid_academic_credentials',
    'academic_password_expired',
    'academic_account_restricted',
  ].includes(error?.code),
  tomorrowStartingPeriod: () => null,
  resolveScheduleAnchor: () => ({ periodId: 'period-1' }),
  getCurrentAcademicWeek: () => 1,
  requireCoursesForPeriod: (records: any[]) => records,
  setCoursesForPeriod: (coursesByPeriod: Record<string, any[]>, periodId: string, records: any[]) => ({
    ...coursesByPeriod,
    [periodId]: records,
  }),
  Date,
  Promise,
}
vm.runInNewContext(compiled, context, { filename: pagePath })
const {
  settle: settleUnderTest,
  loadLatestAcademic: loadLatestAcademicUnderTest,
} = context.__homeAcademicTest

async function run() {
  const networkError = new Error('网络中断')
  const settledFailure = await settleUnderTest(Promise.reject(networkError))
  assert.equal(settledFailure.ok, false)
  assert.equal(settledFailure.error, networkError)

  const credentialError = { code: 'invalid_academic_credentials' }
  const guidanceErrors: unknown[] = []
  courseResponse = Promise.reject(credentialError)
  const cacheAfterCredentialFailure = await loadLatestAcademicUnderTest(
    42,
    cachedSchedule,
    false,
    () => true,
    (error: unknown) => guidanceErrors.push(error),
  )
  assert.deepEqual(guidanceErrors, [credentialError], '密码错误应传递给首页快捷入口')
  assert.equal(cacheAfterCredentialFailure.coursesByPeriod['period-1'][0].id, 'cached-course')

  guidanceErrors.length = 0
  courseResponse = Promise.reject(networkError)
  const cacheAfterNetworkFailure = await loadLatestAcademicUnderTest(
    42,
    cachedSchedule,
    false,
    () => true,
    (error: unknown) => guidanceErrors.push(error),
  )
  assert.deepEqual(guidanceErrors, [], '网络错误不得显示密码更新入口')
  assert.equal(cacheAfterNetworkFailure.coursesByPeriod['period-1'][0].id, 'cached-course')

  guidanceErrors.length = 0
  courseResponse = Promise.reject(credentialError)
  let currentChecks = 0
  await loadLatestAcademicUnderTest(
    42,
    cachedSchedule,
    false,
    () => ++currentChecks === 1,
    (error: unknown) => guidanceErrors.push(error),
  )
  assert.deepEqual(guidanceErrors, [], '过期请求不得更新当前首页的错误提示')

  process.stdout.write('home academic credential guidance smoke: ok\n')
}

void run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exitCode = 1
})
