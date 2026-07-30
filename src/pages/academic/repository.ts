import {
  listAcademicCourses,
  listAcademicCourseSelections,
  listAcademicExams,
  listAcademicGrades,
  listAcademicPeriods,
} from '../../api/academic'
import type {
  AcademicCourse,
  AcademicCourseSelection,
  AcademicExam,
  AcademicGrade,
  AcademicPeriod as AcademicPeriodDTO,
} from '../../api/types'
import {
  AcademicPeriod,
  Course,
  CourseSelectionRecord,
  ExamRecord,
  GradeRecord,
} from './types'
import { courseColors, pad } from './utils'

const stableColor = (id: string) => {
  const hash = [...id].reduce((value, character) => (
    ((value * 31) + character.charCodeAt(0)) >>> 0
  ), 0)
  return courseColors[hash % courseColors.length]
}

const formatDateTime = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const mapPeriod = (period: AcademicPeriodDTO): AcademicPeriod => ({
  id: period.id,
  label: period.label,
  shortLabel: period.short_label,
  startDate: period.start_date.replace(/-/g, '/'),
  weeks: period.week_count,
  isCurrent: period.is_current,
})

const mapCourse = (course: AcademicCourse): Course => ({
  id: course.id,
  periodId: course.period_id,
  courseCode: course.course_code,
  name: course.name,
  teacher: course.teacher,
  location: course.location,
  campus: course.campus,
  weekday: course.weekday,
  startSection: course.start_section,
  endSection: course.end_section,
  weeks: [...course.weeks],
  color: stableColor(course.id),
  source: 'official',
})

const mapGrade = (grade: AcademicGrade): GradeRecord => ({
  id: grade.id,
  periodId: grade.period_id,
  courseName: grade.course_name,
  courseCode: grade.course_code,
  courseType: grade.course_type,
  credit: grade.credit,
  score: grade.score ?? undefined,
  gradeType: grade.grade_type,
  gradeLevel: grade.grade_level ?? undefined,
})

const mapExam = (exam: AcademicExam): ExamRecord => ({
  id: exam.id,
  periodId: exam.period_id,
  courseName: exam.course_name,
  startAt: formatDateTime(exam.start_at),
  endAt: formatDateTime(exam.end_at),
  campus: exam.campus,
  location: exam.location,
  seat: exam.seat,
  phase: exam.phase,
  method: exam.method,
  materials: exam.materials,
  notice: exam.notice,
})

const mapCourseSelection = (
  selection: AcademicCourseSelection,
): CourseSelectionRecord => ({
  id: selection.id,
  periodId: selection.period_id,
  courseName: selection.course_name,
  courseCode: selection.course_code,
  courseType: selection.course_type,
  credit: selection.credit,
  teacher: selection.teacher,
  campus: selection.campus,
  location: selection.location,
  schedule: selection.schedule,
  capacity: selection.capacity,
  enrolled: selection.enrolled,
  status: selection.status,
  selectedAt: formatDateTime(selection.selected_at),
  resultText: selection.result_text ?? undefined,
  note: selection.note ?? undefined,
})

export interface AcademicRepository {
  getPeriods: () => Promise<AcademicPeriod[]>
  getCourses: (periodId: string) => Promise<Course[]>
  getGrades: () => Promise<GradeRecord[]>
  getExams: (periodId: string) => Promise<ExamRecord[]>
  getCourseSelections: (periodId: string) => Promise<CourseSelectionRecord[]>
}

let pendingGradeRequest: Promise<GradeRecord[]> | null = null

const getGrades = () => {
  if (pendingGradeRequest) return pendingGradeRequest
  let tracked: Promise<GradeRecord[]>
  tracked = listAcademicGrades()
    .then((records) => records.map(mapGrade))
    .finally(() => {
      if (pendingGradeRequest === tracked) pendingGradeRequest = null
    })
  pendingGradeRequest = tracked
  return tracked
}

export const academicRepository: AcademicRepository = {
  getPeriods: async () => (await listAcademicPeriods()).map(mapPeriod),
  getCourses: async (periodId) => (await listAcademicCourses(periodId)).map(mapCourse),
  getGrades,
  getExams: async (periodId) => (await listAcademicExams(periodId)).map(mapExam),
  getCourseSelections: async (periodId) => (
    await listAcademicCourseSelections(periodId)
  ).map(mapCourseSelection),
}
