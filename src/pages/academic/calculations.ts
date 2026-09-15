import { Course, GradeLevel, GradeOverride, GradeRecord, GradeSimulation, GradeSummary } from './types'

export const clamp = (value: number, min: number, max: number) => (
  Math.min(Math.max(value, min), max)
)

export const getGradePoint = (score: number) => {
  if (score >= 95) return 4
  if (score >= 90) return 3.9
  if (score >= 85) return 3.7
  if (score >= 81) return 3.3
  if (score >= 78) return 3
  if (score >= 75) return 2.7
  if (score >= 71) return 2.3
  if (score >= 68) return 2
  if (score >= 64) return 1.7
  if (score >= 60) return 1
  return 0
}

interface GradeLevelRule {
  score: number
  gradePoint: number
}

export const fiveLevelOptions: GradeLevel[] = ['优秀', '良好', '中等', '合格', '不合格']
export const twoLevelOptions: GradeLevel[] = ['通过', '不通过']

export const gradeLevelRules: Record<GradeLevel, GradeLevelRule> = {
  优秀: { score: 90, gradePoint: 3.9 },
  优: { score: 90, gradePoint: 3.9 },
  免修: { score: 90, gradePoint: 3.9 },
  通过: { score: 85, gradePoint: 3.7 },
  良: { score: 80, gradePoint: 3.3 },
  良好: { score: 80, gradePoint: 3.3 },
  中: { score: 70, gradePoint: 2.3 },
  中等: { score: 70, gradePoint: 2.3 },
  合格: { score: 60, gradePoint: 1 },
  及格: { score: 60, gradePoint: 1 },
  不合格: { score: 0, gradePoint: 0 },
  不及格: { score: 0, gradePoint: 0 },
  不通过: { score: 0, gradePoint: 0 },
}

export const gradeLevelScores = Object.fromEntries(
  Object.entries(gradeLevelRules).map(([level, rule]) => [level, rule.score]),
) as Record<GradeLevel, number>

export const getGradeLevelRule = (level?: GradeLevel) => (
  level ? gradeLevelRules[level.trim()] : undefined
)

export const getCanonicalGradeLevel = (level?: GradeLevel): GradeLevel | undefined => {
  switch (level?.trim()) {
    case '优':
    case '免修':
      return '优秀'
    case '良':
      return '良好'
    case '中':
      return '中等'
    case '及格':
      return '合格'
    case '不及格':
      return '不合格'
    default:
      return level?.trim()
  }
}

export const isTwoLevelGrade = (level?: GradeLevel) => (
  level?.trim() === '通过' || level?.trim() === '不通过'
)

export const getGradeScore = (
  grade: GradeRecord,
  override?: GradeOverride,
): number | undefined => {
  if (grade.gradeType === 'level') {
    const level = override?.gradeLevel || grade.gradeLevel
    return override?.score ?? getGradeLevelRule(level)?.score
  }
  return override?.score ?? grade.score
}

export const getGradePointForGrade = (
  grade: GradeRecord,
  override?: GradeOverride,
): number | undefined => {
  if (override?.gradePoint !== undefined) return override.gradePoint
  if (grade.gradeType === 'level') {
    const level = override?.gradeLevel || grade.gradeLevel
    const levelPoint = getGradeLevelRule(level)?.gradePoint
    if (levelPoint !== undefined) return levelPoint
    if (override?.score !== undefined) return getGradePoint(override.score)
    return undefined
  }
  const score = getGradeScore(grade, override)
  return score === undefined ? undefined : getGradePoint(score)
}

export const getGradeDisplay = (grade: GradeRecord, override?: GradeOverride) => (
  grade.gradeType === 'level'
    ? override?.gradeLevel || grade.gradeLevel || '未评级'
    : String(override?.score ?? grade.score ?? '暂无')
)

export const calculateGradeSummary = (
  grades: GradeRecord[],
  simulation: GradeSimulation,
): GradeSummary => {
  const selected = grades.filter((grade) => simulation.selectedIds.includes(grade.id))
  const totals = selected.reduce((result, grade) => {
    const override = simulation.overrides[grade.id]
    const credit = override?.credit ?? grade.credit
    if (!Number.isFinite(credit) || credit <= 0) return result
    const score = getGradeScore(grade, override)
    const gradePoint = getGradePointForGrade(grade, override)
    const hasWeightedScore = typeof score === 'number' && Number.isFinite(score) && score > 0
    const hasGradePoint = typeof gradePoint === 'number' && Number.isFinite(gradePoint) && gradePoint > 0

    return {
      selectedCount: result.selectedCount + 1,
      credits: result.credits + credit,
      weightedScoreCredits: result.weightedScoreCredits + (hasWeightedScore ? credit : 0),
      weightedScoreTotal: result.weightedScoreTotal + (hasWeightedScore ? score * credit : 0),
      gpaCredits: result.gpaCredits + (hasGradePoint ? credit : 0),
      weightedPointTotal: result.weightedPointTotal + (hasGradePoint ? gradePoint * credit : 0),
    }
  }, {
    selectedCount: 0,
    credits: 0,
    weightedScoreCredits: 0,
    weightedScoreTotal: 0,
    gpaCredits: 0,
    weightedPointTotal: 0,
  })

  if (!totals.credits) {
    return { selectedCount: 0, credits: 0, weightedScore: 0, gpa: 0 }
  }

  return {
    selectedCount: totals.selectedCount,
    credits: Number(totals.credits.toPrecision(12)),
    weightedScore: totals.weightedScoreCredits
      ? Number((totals.weightedScoreTotal / totals.weightedScoreCredits).toFixed(3))
      : 0,
    gpa: totals.gpaCredits
      ? Number((totals.weightedPointTotal / totals.gpaCredits).toFixed(3))
      : 0,
  }
}

export const findCourseConflicts = (draft: CustomCourseDraftLike, courses: Course[]) => (
  courses.filter((course) => (
    course.id !== draft.id
    && course.periodId === draft.periodId
    && course.weekday === draft.weekday
    && course.startSection <= draft.endSection
    && course.endSection >= draft.startSection
    && course.weeks.some((week) => draft.weeks.includes(week))
  ))
)

interface CustomCourseDraftLike {
  id?: string
  periodId: string
  weekday: number
  startSection: number
  endSection: number
  weeks: number[]
}
