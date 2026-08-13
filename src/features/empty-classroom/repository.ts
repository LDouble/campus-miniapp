import { apiRequest, createIdempotencyKey } from '../../api/client'
import type { components } from '../../api/generated/schema'
import { normalizeDayAvailabilityGroups } from './day-view'

export type EmptyClassroomAvailability = components['schemas']['EmptyClassroomAvailability']
export type EmptyClassroomDayAvailability = components['schemas']['EmptyClassroomDayAvailability']
export type ClassroomView = components['schemas']['ClassroomView']
export type ClassroomReportCategory = components['schemas']['ClassroomReportCategory']
export type ClassroomOccupancyReportView = components['schemas']['ClassroomOccupancyReportView']

export type EmptyClassroomQuery = {
  campus: string
  date: string
  startSection: number
  endSection: number
}

export type EmptyClassroomDayQuery = {
  campus: string
  periodId: string
  teachingWeek: number
  weekday: number
}

export const normalizeEmptyClassroomDayAvailability = (
  value: EmptyClassroomDayAvailability,
): EmptyClassroomDayAvailability => ({
  ...value,
  groups: normalizeDayAvailabilityGroups(value.groups),
})

export type ClassroomReportInput = {
  classroomId: number
  serviceDate: string
  startSection: number
  endSection: number
  category: ClassroomReportCategory
  description?: string
}

export const loadAvailableClassrooms = (query: EmptyClassroomQuery) => (
  apiRequest<EmptyClassroomAvailability>({
    path: '/api/v1/classrooms/available',
    query: {
      campus: query.campus,
      date: query.date,
      start_section: query.startSection,
      end_section: query.endSection,
    },
  })
)

export const loadClassroomDayAvailability = (query: EmptyClassroomDayQuery) => (
  apiRequest<EmptyClassroomDayAvailability>({
    path: '/api/v1/classrooms/availability/day',
    query: {
      campus: query.campus,
      period_id: query.periodId,
      teaching_week: query.teachingWeek,
      weekday: query.weekday,
    },
  }).then(normalizeEmptyClassroomDayAvailability)
)

export const createClassroomOccupancyReport = (input: ClassroomReportInput) => (
  apiRequest<ClassroomOccupancyReportView>({
    path: '/api/v1/classrooms/reports',
    method: 'POST',
    idempotencyKey: createIdempotencyKey('classroom-report'),
    data: {
      classroom_id: input.classroomId,
      service_date: input.serviceDate,
      start_section: input.startSection,
      end_section: input.endSection,
      category: input.category,
      description: input.description,
    },
  })
)
