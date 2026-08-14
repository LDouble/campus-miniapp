import { strict as assert } from 'node:assert'
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

console.log('academic-statistics smoke tests passed')
