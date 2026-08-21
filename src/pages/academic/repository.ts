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
import type { AcademicQueryResult } from '../../api/academic'
import { apiDateTimeCampusParts } from '../../utils/date-time'
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
  const parts = apiDateTimeCampusParts(value)
  if (!parts) return value
  return `${parts.year}/${pad(parts.month)}/${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)}`
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
  note: course.note,
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
  getPeriods: (options?: { force?: boolean }) => Promise<AcademicPeriod[]>
  getCourses: (periodId: string) => Promise<AcademicQueryResult<Course>>
  getGrades: () => Promise<AcademicQueryResult<GradeRecord>>
  getExams: (periodId: string) => Promise<AcademicQueryResult<ExamRecord>>
  getCourseSelections: (periodId: string) => Promise<AcademicQueryResult<CourseSelectionRecord>>
}

const mapQueryResult = <Source, Target>(
  result: AcademicQueryResult<Source>,
  map: (record: Source) => Target,
): AcademicQueryResult<Target> => ({
  records: result.records.map(map),
  ...(result.cache ? { cache: result.cache } : {}),
  ...(result.scheduleNote !== undefined ? { scheduleNote: result.scheduleNote } : {}),
})

let pendingGradeRequest: Promise<AcademicQueryResult<GradeRecord>> | null = null

const getGrades = () => {
  if (pendingGradeRequest) return pendingGradeRequest
  let tracked: Promise<AcademicQueryResult<GradeRecord>>
  tracked = listAcademicGrades()
    .then((result) => mapQueryResult(result, mapGrade))
    .finally(() => {
      if (pendingGradeRequest === tracked) pendingGradeRequest = null
    })
  pendingGradeRequest = tracked
  return tracked
}

export const academicRepository: AcademicRepository = {
  getPeriods: async (options) => (await listAcademicPeriods(options)).map(mapPeriod),
  getCourses: async (periodId) => mapQueryResult(await listAcademicCourses(periodId), mapCourse),
  getGrades,
  getExams: async (periodId) => mapQueryResult(await listAcademicExams(periodId), mapExam),
  getCourseSelections: async (periodId) => mapQueryResult(
    await listAcademicCourseSelections(periodId),
    mapCourseSelection,
  ),
}
