import { apiRequest, apiRequestEnvelope, isApiError } from './client'
import { getCurrentIdentity } from './account'
import {
  clearAcademicCredential,
  getCredentialRevision,
  loadAcademicCredential,
} from './academic-credential'
import {
  ACADEMIC_CREDENTIAL_INVALIDATION_CODES,
  createAcademicPost,
} from './academic-post'
import type {
  AcademicCourse,
  AcademicCourseSelection,
  AcademicCourseAdditionResult,
  AcademicCalendar,
  AcademicEducationLevel,
  AcademicExam,
  AcademicGrade,
  AcademicPeriod,
} from './types'
import { createSharedResource } from '../state/shared-resource'

export type { AcademicQueryResult } from './academic-post'

export const getAcademicCalendar = (educationLevel: AcademicEducationLevel) => (
  apiRequest<AcademicCalendar>({
    path: '/api/v1/academic/calendar',
    method: 'GET',
    query: { education_level: educationLevel },
  })
)

const academicPost = createAcademicPost({
  getCurrentIdentity,
  loadCredential: loadAcademicCredential,
  getCredentialRevision,
  clearCredential: clearAcademicCredential,
  requestEnvelope: (options) => apiRequestEnvelope({
    path: options.path,
    method: 'POST',
    data: options.data,
  }),
  isCredentialInvalidationError: (error) => (
    isApiError(error)
    && (ACADEMIC_CREDENTIAL_INVALIDATION_CODES as readonly string[]).includes(error.code)
  ),
})

export const ACADEMIC_PERIODS_FRESH_MS = 30 * 60 * 1000

const academicPeriodsResource = createSharedResource<AcademicPeriod[]>({
  maxAgeMs: ACADEMIC_PERIODS_FRESH_MS,
  group: 'academic',
})

export const listAcademicPeriods = (options: { force?: boolean } = {}) => (
  academicPeriodsResource.ensure(() => apiRequest<AcademicPeriod[]>({
    path: '/api/v1/academic/periods',
    method: 'POST',
  }), options)
)

export const invalidateAcademicPeriods = () => {
  academicPeriodsResource.invalidate()
}

export const listAcademicCourses = (periodId: string) => academicPost<AcademicCourse>(
  '/api/v1/academic/courses',
  periodId,
)

export const listAcademicGrades = () => academicPost<AcademicGrade>(
  '/api/v1/academic/grades',
)

export const listAcademicExams = (periodId: string) => academicPost<AcademicExam>(
  '/api/v1/academic/exams',
  periodId,
)

export const listAcademicCourseSelections = (periodId: string) => (
  academicPost<AcademicCourseSelection>(
    '/api/v1/academic/course-selections',
    periodId,
  )
)

export const listAcademicCourseAdditionResults = (periodId: string) => (
  academicPost<AcademicCourseAdditionResult>(
    '/api/v1/academic/course-addition-results',
    periodId,
  )
)

/** 获取教务系统已选课程的结构化课表；不会修改本地模拟选课草稿。 */
export const listAcademicCourseSelectionSchedule = (periodId: string) => (
  academicPost<AcademicCourse>(
    '/api/v1/academic/course-selection-schedule',
    periodId,
  )
)
