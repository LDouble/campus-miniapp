import { Course, GradeLevel, GradeOverride, GradeRecord, GradeSimulation, GradeSummary } from './types'

export const clamp = (value: number, min: number, max: number) => (
  Math.min(Math.max(value, min), max)
)

export const getGradePoint = (score: number) => {
  if (score >= 90) return 4
  if (score >= 85) return 3.7
  if (score >= 82) return 3.3
  if (score >= 78) return 3
  if (score >= 75) return 2.7
  if (score >= 72) return 2.3
  if (score >= 68) return 2
  if (score >= 64) return 1.5
  if (score >= 60) return 1
  return 0
}

export const gradeLevelScores: Partial<Record<GradeLevel, number>> = {
  优秀: 95,
  良好: 85,
  中等: 75,
  及格: 62,
  不及格: 0,
}

export const getGradeScore = (
  grade: GradeRecord,
  override?: GradeOverride,
): number | undefined => {
  if (grade.gradeType === 'level') {
    const level = override?.gradeLevel || grade.gradeLevel
    return override?.score ?? grade.score ?? (level ? gradeLevelScores[level] : undefined)
  }
  return override?.score ?? grade.score
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
    const score = getGradeScore(grade, override)
    if (score === undefined) return result
    const credit = override?.credit ?? grade.credit

    return {
      selectedCount: result.selectedCount + 1,
      credits: result.credits + credit,
      weightedScore: result.weightedScore + score * credit,
      weightedPoint: result.weightedPoint + getGradePoint(score) * credit,
    }
  }, {
    selectedCount: 0,
    credits: 0,
    weightedScore: 0,
    weightedPoint: 0,
  })

  if (!totals.credits) {
    return { selectedCount: 0, credits: 0, weightedScore: 0, gpa: 0 }
  }

  return {
    selectedCount: totals.selectedCount,
    credits: Number(totals.credits.toFixed(1)),
    weightedScore: Number((totals.weightedScore / totals.credits).toFixed(2)),
    gpa: Number((totals.weightedPoint / totals.credits).toFixed(2)),
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
