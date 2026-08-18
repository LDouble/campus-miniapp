import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  ACADEMIC_REFRESH_SIGNAL_KEY,
  ACADEMIC_REFRESH_SIGNAL_TTL,
  consumeAcademicRefreshAfterVerification,
  isAcademicRefreshRoute,
  markAcademicRefreshAfterVerification,
  resolveAcademicRefreshReturnRoute,
} from '../src/features/academic-verification/refresh-signal'
import {
  emptyAcademicVerificationStatus,
  isMissingAcademicVerificationStatus,
} from '../src/features/academic-verification/missing-status'

const grades = '/pages/academic/grades/index'
const schedule = '/pages/academic/schedule/index'
const exams = '/pages/academic/exams/index'
const selection = '/pages/academic/selection/index'
const statisticsCourses = '/pages/academic/statistics/courses'
const statisticsDetail = '/pages/academic/statistics/index'

assert.deepEqual(emptyAcademicVerificationStatus(), {
  identity: null,
  latest_request: null,
})
for (const code of [
  'academic_verification_not_found',
  'academic_verification_request_not_found',
  'academic_review_not_found',
  'academic_request_not_found',
  'academic_identity_not_found',
]) {
  assert.equal(
    isMissingAcademicVerificationStatus(404, code),
    true,
    `${code} 应按未绑定状态处理`,
  )
}
assert.equal(isMissingAcademicVerificationStatus(500, 'academic_request_not_found'), false)
assert.equal(isMissingAcademicVerificationStatus(404, 'academic_material_not_found'), false)

const values = new Map<string, unknown>()
const storage = {
  getStorageSync<T>(key: string) { return values.get(key) as T | undefined },
  setStorageSync<T>(key: string, value: T) { values.set(key, value) },
  removeStorageSync(key: string) { values.delete(key) },
}

for (const path of [
  grades,
  schedule,
  exams,
  selection,
  statisticsCourses,
  statisticsDetail,
]) {
  assert.equal(isAcademicRefreshRoute(path), true)
}
assert.equal(isAcademicRefreshRoute('/pages/index/index'), false)
assert.equal(resolveAcademicRefreshReturnRoute(`${grades}?rebind=1`), grades)
assert.equal(resolveAcademicRefreshReturnRoute(schedule, exams.slice(1)), exams)
assert.equal(
  resolveAcademicRefreshReturnRoute(statisticsCourses, statisticsDetail.slice(1)),
  statisticsDetail,
)
assert.equal(resolveAcademicRefreshReturnRoute('/pages/index/index', 'pages/profile/index'), null)

const now = 1_000_000
markAcademicRefreshAfterVerification(storage, selection, now)
assert.equal(consumeAcademicRefreshAfterVerification(storage, selection, now), true)
assert.equal(consumeAcademicRefreshAfterVerification(storage, selection, now), false)

markAcademicRefreshAfterVerification(storage, grades, now)
assert.equal(consumeAcademicRefreshAfterVerification(storage, exams, now), false)
assert.ok(values.has(ACADEMIC_REFRESH_SIGNAL_KEY), '不同页面不能提前消费信号')
assert.equal(consumeAcademicRefreshAfterVerification(storage, grades, now), true)

markAcademicRefreshAfterVerification(storage, schedule, now)
assert.equal(
  consumeAcademicRefreshAfterVerification(storage, schedule, now + ACADEMIC_REFRESH_SIGNAL_TTL + 1),
  false,
)
assert.equal(values.has(ACADEMIC_REFRESH_SIGNAL_KEY), false)

const pageRefreshes = [
  ['grades', grades, 'refreshGrades'],
  ['schedule', schedule, 'refreshSchedule'],
  ['exams', exams, 'refreshExams'],
  ['selection', selection, 'refreshSelections'],
] as const

for (const [directory, path, refreshFunction] of pageRefreshes) {
  const source = readFileSync(
    resolve(__dirname, `../src/pages/academic/${directory}/index.tsx`),
    'utf8',
  )
  assert.ok(
    source.includes('Taro.useDidShow(() => {')
      && source.includes('consumeAcademicRefreshAfterVerification(')
      && source.includes(`'${path}'`)
      && source.includes(`void ${refreshFunction}`)
      && source.includes('RequestRef.current !== requestId'),
    `${directory} 应仅消费匹配的绑定成功信号，并避免旧请求覆盖新数据`,
  )
}

for (const file of ['courses.tsx', 'index.tsx']) {
  const source = readFileSync(
    resolve(__dirname, `../src/pages/academic/statistics/${file}`),
    'utf8',
  )
  assert.ok(
    source.includes('Taro.useDidShow(() => {')
      && source.includes('consumeAcademicRefreshAfterVerification('),
    `${file} 应在绑定成功返回后自动刷新课程通过率`,
  )
}

const verificationPage = readFileSync(
  resolve(__dirname, '../src/pages/academic-verification/index.tsx'),
  'utf8',
)
const verificationApi = readFileSync(
  resolve(__dirname, '../src/api/academic-verification.ts'),
  'utf8',
)
const verificationGuard = readFileSync(
  resolve(__dirname, '../src/features/academic-verification/guard.ts'),
  'utf8',
)
assert.ok(
  verificationApi.includes('isMissingAcademicVerificationStatus(error.statusCode, error.code)')
    && verificationApi.includes('return emptyAcademicVerificationStatus()'),
  '认证状态接口应将旧版无审核记录响应转换为正常未绑定状态',
)
assert.ok(
  verificationPage.includes('finishAcademicVerification(replacedCurrentPage, true)')
    && verificationGuard.includes('if (refreshAcademicPage) {'),
  '只有本次教务账号绑定成功后才应写入返回页刷新信号',
)

process.stdout.write('academic verification refresh smoke: ok\n')
