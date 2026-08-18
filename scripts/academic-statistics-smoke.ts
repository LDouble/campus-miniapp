import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  academicStatisticsTermKey,
  formatAcademicStatisticsTerm,
} from '../src/features/academic-statistics/term-label'

assert.equal(
  formatAcademicStatisticsTerm({
    term_code: '2025-2026-2',
    term_label: '2025 秋季学期',
  }),
  '2025 秋季学期',
)
assert.equal(
  formatAcademicStatisticsTerm({ term_code: '2025-2026-1' }),
  '25-26 夏',
)
assert.equal(
  formatAcademicStatisticsTerm({ term_code: '2025-2026-2' }),
  '25-26 秋',
)
assert.equal(
  formatAcademicStatisticsTerm({ term_code: '2025-2026-3' }),
  '25-26 春',
)
assert.equal(
  formatAcademicStatisticsTerm({ term_code: 'invalid-term' }),
  'invalid-term',
)
assert.equal(
  academicStatisticsTermKey({
    term_code: '2025-2026-3',
    education_level: 'undergraduate',
    period_id: '2025-2026-3',
  }),
  'undergraduate:2025-2026-3',
)

const statisticsApi = readFileSync(resolve(__dirname, '../src/api/academic-statistics.ts'), 'utf8')
assert.equal(
  statisticsApi.match(/skipAcademicVerificationGuard: true/g)?.length,
  4,
  '课程通过率接口应让页面接管未绑定引导，避免请求层自动弹窗',
)
assert.equal(
  statisticsApi.match(/withAcademicBindingGuidance\(apiRequest/g)?.length,
  4,
  '课程通过率的四个接口都应精确归因权限拒绝',
)
assert.ok(
  statisticsApi.includes("error.statusCode !== 403")
  && statisticsApi.includes("error.code !== 'forbidden'")
  && statisticsApi.includes('getAcademicVerificationStatus({ force: true })')
  && statisticsApi.includes("status.identity?.status !== 'verified'"),
  '403 forbidden 应强制刷新教务身份，仅对未认证用户展示绑定引导',
)

const statisticsRepository = readFileSync(
  resolve(__dirname, '../src/features/academic-statistics/repository.ts'),
  'utf8',
)
assert.equal(
  statisticsRepository.match(/if \(isAcademicBindingRequiredError\(error\)\) throw error/g)?.length,
  2,
  '未绑定时不得用通过率旧缓存掩盖绑定引导',
)

for (const path of [
  '../src/pages/academic/statistics/courses.tsx',
  '../src/pages/academic/statistics/index.tsx',
  '../src/features/academic-statistics/course-pass-rate-preview/index.tsx',
]) {
  const source = readFileSync(resolve(__dirname, path), 'utf8')
  assert.ok(
    source.includes('isAcademicBindingRequiredError'),
    `${path} 应识别并引导处理未绑定错误`,
  )
}

console.log('academic-statistics smoke tests passed')
