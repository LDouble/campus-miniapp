export type AcademicSection = 'schedule' | 'grades' | 'exams'
export type ScheduleView = 'week' | 'day'
export type CourseSource = 'official' | 'custom'
export type ExamFilter = 'all' | 'upcoming' | 'finished'
export type ExamPhase = '期中' | '期末' | '补考' | '入学'
export type CourseSelectionStatus = 'selected' | 'pending' | 'failed'

export interface AcademicPeriod {
  id: string
  label: string
  shortLabel: string
  startDate: string
  weeks: number
  isCurrent: boolean
}

export interface Course {
  id: string
  periodId: string
  courseCode?: string
  name: string
  teacher: string
  location: string
  campus?: string
  weekday: number
  startSection: number
  endSection: number
  weeks: number[]
  color: string
  source: CourseSource
}

export interface CustomCourseDraft {
  id?: string
  periodId: string
  name: string
  teacher: string
  location: string
  weekday: number
  startSection: number
  endSection: number
  weeks: number[]
  color: string
}

export interface GradeRecord {
  id: string
  periodId: string
  courseName: string
  courseCode?: string
  courseType: string
  credit: number
  score?: number
  gradeType?: 'number' | 'level'
  gradeLevel?: GradeLevel
}

export interface GradePeriod {
  id: string
  label: string
  shortLabel: string
}

export type GradeLevel = string

export interface GradeOverride {
  score?: number
  gradePoint?: number
  gradeLevel?: GradeLevel
  credit: number
}

export interface GradeSimulation {
  selectedIds: string[]
  overrides: Record<string, GradeOverride>
}

export interface ExamRecord {
  id: string
  periodId: string
  courseName: string
  startAt: string
  endAt: string
  campus: string
  location: string
  seat: string
  phase: ExamPhase
  method: string
  materials: string
  notice: string
}

export interface CourseSelectionRecord {
  id: string
  periodId: string
  courseName: string
  courseCode: string
  courseType: string
  credit: number
  teacher: string
  campus: string
  location: string
  schedule: string
  capacity: number
  enrolled: number
  status: CourseSelectionStatus
  selectedAt: string
  resultText?: string
  note?: string
}

export interface AcademicPreferences {
  section: AcademicSection
  schedulePeriodId: string
  gradePeriodId: string
  examPeriodId: string
  week: number
  selectedWeekday: number
  scheduleView: ScheduleView
}

export interface GradeSummary {
  selectedCount: number
  credits: number
  weightedScore: number
  gpa: number
}
