import { strict as assert } from 'node:assert'
import {
  calculateGradeSummary,
  getGradePoint,
  getGradePointForGrade,
  getGradeScore,
} from '../src/pages/academic/calculations'
import { GradeRecord, GradeSimulation } from '../src/pages/academic/types'

const emptySimulation = (selectedIds: string[]): GradeSimulation => ({
  selectedIds,
  overrides: {},
})

// 百分制边界应严格遵循校内换算表。
assert.equal(getGradePoint(95), 4)
assert.equal(getGradePoint(94.99), 3.9)
assert.equal(getGradePoint(90), 3.9)
assert.equal(getGradePoint(89.99), 3.7)
assert.equal(getGradePoint(85), 3.7)
assert.equal(getGradePoint(81), 3.3)
assert.equal(getGradePoint(78), 3)
assert.equal(getGradePoint(75), 2.7)
assert.equal(getGradePoint(71), 2.3)
assert.equal(getGradePoint(68), 2)
assert.equal(getGradePoint(64), 1.7)
assert.equal(getGradePoint(60), 1)
assert.equal(getGradePoint(59.99), 0)

const levelGrade = (gradeLevel: string): GradeRecord => ({
  id: gradeLevel,
  periodId: '2025-2026-2',
  courseName: `${gradeLevel}课程`,
  courseType: '必修',
  credit: 1,
  gradeType: 'level',
  gradeLevel,
})

// 五级制、二级制及其常见同义写法，应分别映射折算分和绩点。
assert.equal(getGradeScore(levelGrade('优秀')), 90)
assert.equal(getGradeScore(levelGrade('优')), 90)
assert.equal(getGradeScore(levelGrade('免修')), 90)
assert.equal(getGradeScore(levelGrade('良好')), 80)
assert.equal(getGradeScore(levelGrade('良')), 80)
assert.equal(getGradeScore(levelGrade('中等')), 70)
assert.equal(getGradeScore(levelGrade('中')), 70)
assert.equal(getGradeScore(levelGrade('合格')), 60)
assert.equal(getGradeScore(levelGrade('及格')), 60)
assert.equal(getGradeScore(levelGrade('通过')), 85)
assert.equal(getGradeScore(levelGrade('不通过')), 0)
assert.equal(getGradePointForGrade(levelGrade('优秀')), 3.9)
assert.equal(getGradePointForGrade(levelGrade('良好')), 3.3)
assert.equal(getGradePointForGrade(levelGrade('中等')), 2.3)
assert.equal(getGradePointForGrade(levelGrade('合格')), 1)
assert.equal(getGradePointForGrade(levelGrade('通过')), 3.7)
assert.equal(getGradePointForGrade(levelGrade('不合格')), 0)
assert.equal(getGradePointForGrade(levelGrade('未识别等级')), undefined)
assert.equal(getGradeScore(levelGrade(' 通过 ')), 85)
assert.equal(getGradePointForGrade(levelGrade(' 通过 ')), 3.7)

const overrideGrade: GradeRecord = {
  id: 'override-grade-point',
  periodId: '2025-2026-2',
  courseName: '可修改绩点课程',
  courseType: '必修',
  credit: 1,
  score: 90,
}
const overrideSummary = calculateGradeSummary([overrideGrade], {
  selectedIds: [overrideGrade.id],
  overrides: {
    [overrideGrade.id]: { score: 95, credit: 1, gradePoint: 1.2 },
  },
})
assert.equal(overrideSummary.weightedScore, 95)
assert.equal(overrideSummary.gpa, 1.2, '手动绩点应优先于规则映射')

const tinyCreditGrades: GradeRecord[] = [
  {
    id: 'tiny-number',
    periodId: '2025-2026-2',
    courseName: '极小学分百分制',
    courseType: '选修',
    credit: 0.01,
    score: 95,
  },
  {
    ...levelGrade('优秀'),
    id: 'tiny-level',
    courseName: '极小学分五级制',
    credit: 0.01,
  },
]
const tinyCreditSummary = calculateGradeSummary(
  tinyCreditGrades,
  emptySimulation(tinyCreditGrades.map((grade) => grade.id)),
)
assert.equal(tinyCreditSummary.credits, 0.02)
assert.equal(tinyCreditSummary.selectedCount, 2)
assert.equal(tinyCreditSummary.weightedScore, 92.5)
assert.equal(tinyCreditSummary.gpa, 3.95)

const subHundredthCreditSummary = calculateGradeSummary([
  { ...overrideGrade, id: 'sub-hundredth-credit', credit: 0.001 },
], emptySimulation(['sub-hundredth-credit']))
assert.equal(subHundredthCreditSummary.credits, 0.001)

const unknownGrade = levelGrade('待公布')
const unknownSummary = calculateGradeSummary(
  [unknownGrade],
  emptySimulation([unknownGrade.id]),
)
assert.deepEqual(unknownSummary, {
  selectedCount: 0,
  credits: 0,
  weightedScore: 0,
  gpa: 0,
})

process.stdout.write('academic calculations smoke: ok\n')
